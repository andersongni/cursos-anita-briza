'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, HelpCircle, BookOpen, ClipboardList, Award, Settings, Menu, X, LogOut } from 'lucide-react'
import Button from '@/components/ui/Button'
import PlatformLogo from '@/components/ui/PlatformLogo'
import { useSessionGuard } from '@/hooks/useSessionGuard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { profile } = useSessionGuard(20000)
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    router.push('/login')
  }, [router])

  const navItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Alunos', href: '/admin/alunos', icon: Users },
    { name: 'Perguntas', href: '/admin/perguntas', icon: HelpCircle },
    { name: 'Temas', href: '/admin/dimensoes', icon: BookOpen },
    { name: 'Avaliações', href: '/admin/avaliacoes', icon: ClipboardList },
    { name: 'Certificados', href: '/admin/certificados', icon: Award },
    { name: 'Configurações', href: '/admin/configuracoes', icon: Settings },
  ]

  const getPageTitle = () => {
    const item = navItems.find(i => pathname.startsWith(i.href) && i.href !== '/admin')
    return item ? item.name : 'Administração'
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-secondary">
        <div className="flex-1 flex flex-col min-h-0 pt-5 pb-4">
          <div className="flex items-center flex-shrink-0 px-4 mb-6">
            <PlatformLogo width={40} height={40} className="rounded-full" />
            <span className="ml-3 text-white font-bold text-lg truncate">Admin Panel</span>
          </div>
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <item.icon className="mr-3 flex-shrink-0 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-secondary min-h-screen">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="sr-only">Fechar sidebar</span>
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4 mb-6">
                <PlatformLogo width={40} height={40} className="rounded-full" />
                <span className="ml-3 text-white font-bold text-lg truncate">Admin Panel</span>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <item.icon className="mr-4 flex-shrink-0 h-6 w-6" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1 w-full">
        {/* Top Header */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-gray-200">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary md:hidden hover:bg-gray-50"
            onClick={() => setIsSidebarOpen(true)}
          >
            <span className="sr-only">Abrir sidebar</span>
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1 px-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-800">
              {getPageTitle()}
            </h1>

            <div className="ml-4 flex items-center gap-4">
              <span className="hidden sm:block text-sm font-medium text-gray-700">
                {profile?.full_name}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-primary">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:block">Sair</span>
              </Button>
            </div>
          </div>
        </div>

        <main className="flex-1 w-full relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
