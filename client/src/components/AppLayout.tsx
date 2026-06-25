import { useState } from 'react'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard, Users, FolderKanban, FileText, FileCheck, Receipt,
  Camera, Settings, CreditCard, UserCircle2, LogOut, Menu,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useAuth } from '../hooks/useAuth'
import { useLogo, clearLogoCache } from '../hooks/useLogo'

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
}

const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', to: '/clients', icon: Users },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Proposals', to: '/proposals', icon: FileText },
  { label: 'Contracts', to: '/contracts', icon: FileCheck },
  { label: 'Invoices', to: '/invoices', icon: Receipt },
  { label: 'Photos', to: '/photos', icon: Camera },
  { label: 'Team', to: '/team', icon: UserCircle2 },
  { label: 'Settings', to: '/settings', icon: Settings },
  { label: 'Billing', to: '/billing', icon: CreditCard },
]

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const routerState = useRouterState()
  const isActive = routerState.location.pathname.startsWith(item.to)
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-brand-50 text-brand-600'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout, isTrialing, trialDaysLeft } = useAuth()
  const router = useRouter()
  const logoUrl = useLogo()

  async function handleLogout() {
    await logout()
    clearLogoCache()
    router.navigate({ to: '/login' })
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
        {logoUrl ? (
          <img src={logoUrl} alt="Company logo" className="h-8 w-8 rounded-lg object-contain" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white font-bold text-sm">
            G
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">Gilberto Pro</p>
          <p className="text-xs text-gray-500 truncate">{user?.orgName}</p>
        </div>
      </div>

      {/* Trial banner */}
      {isTrialing && trialDaysLeft !== null && (
        <div className="mx-3 mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          <span className="font-medium">{trialDaysLeft}d</span> left in trial
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map((item) => (
          <NavLink key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center gap-2 mb-2 px-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 lg:w-60 flex-col bg-white border-r border-gray-200 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 h-full bg-white shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex md:hidden items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Company logo" className="h-6 w-6 rounded-md object-contain" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500 text-white font-bold text-xs">G</div>
            )}
            <span className="text-sm font-semibold text-gray-900">Gilberto Pro</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
