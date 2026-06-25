import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '../lib/api'

const LOGO_CACHE_KEY = 'orgLogoUrl'

export function useLogo(): string | null {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<{ data: { logoPath: string | null } }>('/api/settings'),
    staleTime: 1000 * 60 * 5,
  })

  const logoPath = data?.data?.logoPath ?? null
  const logoUrl = logoPath ? `/api/public/logo/${logoPath}` : null

  useEffect(() => {
    if (logoUrl) {
      localStorage.setItem(LOGO_CACHE_KEY, logoUrl)
    } else if (logoPath === null && data !== undefined) {
      // Settings loaded and no logo — clear stale cache
      localStorage.removeItem(LOGO_CACHE_KEY)
    }
  }, [logoUrl, logoPath, data])

  return logoUrl
}

export function clearLogoCache(): void {
  localStorage.removeItem(LOGO_CACHE_KEY)
}

export function getCachedLogoUrl(): string | null {
  return localStorage.getItem(LOGO_CACHE_KEY)
}
