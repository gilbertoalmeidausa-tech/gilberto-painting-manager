import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onPage: (p: number) => void
}

export function Pagination({ page, limit, total, onPage }: PaginationProps) {
  const pages = Math.ceil(total / limit)
  if (pages <= 1) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
      <p className="text-sm text-gray-500">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
