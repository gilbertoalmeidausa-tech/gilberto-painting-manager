import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { AppLayout } from '../components/AppLayout'
import { FullPageSpinner } from '../components/Spinner'

export const Route = createFileRoute('/_app')({
  component: AppRoot,
})

function AppRoot() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: '/login', replace: true })
    }
  }, [user, isLoading, navigate])

  if (isLoading) return <FullPageSpinner />
  if (!user) return null

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
