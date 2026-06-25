import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserCircle2, UserPlus, Trash2 } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { formatDate } from '../../lib/formatters'
import { Modal } from '../../components/Modal'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { useAuth } from '../../hooks/useAuth'

export const Route = createFileRoute('/_app/team')({
  component: TeamPage,
})

interface Member {
  id: string
  role: string
  joinedAt: string
  user: { id: string; name: string; email: string; avatarPath: string | null }
}

const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'employee']),
})
type InviteForm = z.infer<typeof inviteSchema>

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'employee' },
  })

  async function onSubmit(data: InviteForm) {
    await apiFetch('/api/team/invitations', { method: 'POST', body: JSON.stringify(data) })
    qc.invalidateQueries({ queryKey: ['team-invitations'] })
    onClose()
    reset()
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite Team Member">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email Address</label>
          <input {...register('email')} type="email" className="input" placeholder="colleague@example.com" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Role</label>
          <select {...register('role')} className="input">
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <p className="text-xs text-gray-500">An invitation link will be generated. Share it with the invitee.</p>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <Spinner size="sm" /> : 'Send Invite'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-brand-100 text-brand-700',
  admin: 'bg-blue-100 text-blue-700',
  employee: 'bg-gray-100 text-gray-700',
}

function TeamPage() {
  const { user } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => apiFetch<{ data: Member[] }>('/api/team/members'),
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => apiFetch(`/api/team/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      apiFetch(`/api/team/members/${memberId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  })

  const canManage = user?.role === 'owner' || user?.role === 'admin'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.data.length ?? 0} members</p>
        </div>
        {canManage && (
          <button onClick={() => setInviteOpen(true)} className="btn-primary">
            <UserPlus className="h-4 w-4" />Invite Member
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data?.data.length === 0 ? (
        <EmptyState icon={UserCircle2} title="No team members" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Member</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 hidden md:table-cell">Joined</th>
                {canManage && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.data.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-sm shrink-0">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{m.user.name} {m.user.id === user?.id && <span className="text-xs text-gray-400">(you)</span>}</p>
                        <p className="text-xs text-gray-500">{m.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {canManage && m.role !== 'owner' && m.user.id !== user?.id ? (
                      <select
                        value={m.role}
                        onChange={(e) => updateRoleMutation.mutate({ memberId: m.id, role: e.target.value })}
                        className="input w-auto text-sm"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`badge ${ROLE_COLORS[m.role] ?? 'bg-gray-100 text-gray-700'}`}>
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-gray-500">{formatDate(m.joinedAt)}</td>
                  {canManage && (
                    <td className="px-5 py-4">
                      {m.role !== 'owner' && m.user.id !== user?.id && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => { if (confirm(`Remove ${m.user.name}?`)) removeMutation.mutate(m.id) }}
                            className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          ><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  )
}
