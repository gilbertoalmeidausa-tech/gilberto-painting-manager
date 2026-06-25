import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { Camera, Trash2, Upload } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { EmptyState } from '../../components/EmptyState'
import { PageSpinner, Spinner } from '../../components/Spinner'
import { StatusBadge } from '../../components/StatusBadge'

export const Route = createFileRoute('/_app/photos')({
  component: PhotosPage,
})

interface Photo {
  id: string; filePath: string; phase: string; caption: string | null
  originalFilename: string | null; fileSizeBytes: number | null; createdAt: string
  projectId: string | null
}

const PHASES = ['before', 'during', 'after', 'completed'] as const

function PhotosPage() {
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedPhase, setSelectedPhase] = useState<string>('before')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data: projectsData } = useQuery({
    queryKey: ['projects-mini'],
    queryFn: () => apiFetch<{ data: Array<{ id: string; name: string }> }>('/api/projects?limit=100'),
  })

  const { data: photosData, isLoading } = useQuery({
    queryKey: ['photos', selectedProjectId],
    queryFn: () => apiFetch<{ data: Photo[] }>(`/api/photos?projectId=${selectedProjectId}`),
    enabled: !!selectedProjectId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/photos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photos'] }),
  })

  async function uploadFiles(files: FileList | File[]) {
    if (!selectedProjectId) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('projectId', selectedProjectId)
        fd.append('phase', selectedPhase)
        await apiFetch('/api/photos', { method: 'POST', body: fd })
      }
      qc.invalidateQueries({ queryKey: ['photos'] })
    } finally {
      setUploading(false)
    }
  }

  const photos = photosData?.data ?? []
  const byPhase = PHASES.reduce((acc, phase) => {
    acc[phase] = photos.filter((p) => p.phase === phase)
    return acc
  }, {} as Record<string, Photo[]>)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Photos</h1>
        <p className="text-sm text-gray-500 mt-1">Before, during, and after photos for each project</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">Project</label>
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="input">
            <option value="">— Select a project —</option>
            {projectsData?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {selectedProjectId && (
          <div>
            <label className="label">Upload Phase</label>
            <select value={selectedPhase} onChange={(e) => setSelectedPhase(e.target.value)} className="input">
              {PHASES.map((ph) => <option key={ph} value={ph}>{ph}</option>)}
            </select>
          </div>
        )}
        {selectedProjectId && (
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary">
            {uploading ? <Spinner size="sm" /> : <><Upload className="h-4 w-4" />Upload Photos</>}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
      />

      {!selectedProjectId ? (
        <EmptyState icon={Camera} title="Select a project" description="Choose a project to view and upload photos." />
      ) : isLoading ? (
        <PageSpinner />
      ) : photos.length === 0 ? (
        <div
          className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-300'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); e.dataTransfer.files && uploadFiles(e.dataTransfer.files) }}
        >
          <Camera className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Drop photos here or</p>
          <button onClick={() => fileInputRef.current?.click()} className="btn-primary mt-3">
            <Upload className="h-4 w-4" />Choose Files
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {PHASES.map((phase) => {
            const phs = byPhase[phase]
            if (phs.length === 0) return null
            return (
              <div key={phase}>
                <div className="flex items-center gap-2 mb-3">
                  <StatusBadge status={phase} />
                  <span className="text-sm text-gray-500">{phs.length} photo{phs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {phs.map((photo) => (
                    <div key={photo.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img
                        src={`/api/photos/file/${photo.filePath}`}
                        alt={photo.caption ?? photo.originalFilename ?? 'Photo'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <button
                          onClick={() => { if (confirm('Delete this photo?')) deleteMutation.mutate(photo.id) }}
                          className="opacity-0 group-hover:opacity-100 rounded-full bg-white/90 p-2 text-red-600 hover:bg-white transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {photo.caption && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1">
                          <p className="text-xs text-white truncate">{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
