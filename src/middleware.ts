import { NextResponse, type NextRequest } from 'next/server'
import {
  clearSessionCookieOnResponse,
  getSessionFromRequest,
  isSessionIdle,
  refreshSessionActivity,
  setSessionCookieOnResponse,
  shouldRefreshActivity,
} from '@/lib/auth/session'

async function withOptionalActivityRefresh(
  request: NextRequest,
  session: NonNullable<Awaited<ReturnType<typeof getSessionFromRequest>>>,
  response: NextResponse
): Promise<NextResponse> {
  if (!shouldRefreshActivity(session)) return response
  try {
    const token = await refreshSessionActivity(session)
    setSessionCookieOnResponse(response, token)
  } catch {
    // Navegação segue mesmo se o refresh falhar
  }
  return response
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const authRoutes = ['/login', '/cadastro']
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r))
  const isWaitingPage = pathname === '/aguardando-aprovacao'
  const isChangePasswordPage = pathname === '/alterar-senha'
  const isApiRoute = pathname.startsWith('/api')

  if (isApiRoute) {
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(request)

  // Sem sessão: só login/cadastro (e a página de espera redireciona ao login)
  if (!session) {
    if (isAuthRoute) {
      return NextResponse.next()
    }
    if (isWaitingPage || isChangePasswordPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Inatividade de 24h
  if (isSessionIdle(session)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('idle', '1')
    const response = NextResponse.redirect(url)
    clearSessionCookieOnResponse(response)
    return response
  }

  // Conta bloqueada
  if (session.status === 'BLOCKED') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('blocked', 'true')
    const response = NextResponse.redirect(url)
    clearSessionCookieOnResponse(response)
    return response
  }

  // Obrigatório trocar senha no primeiro acesso
  if (session.mustChangePassword) {
    if (!isChangePasswordPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/alterar-senha'
      return withOptionalActivityRefresh(request, session, NextResponse.redirect(url))
    }
    return withOptionalActivityRefresh(request, session, NextResponse.next())
  }

  if (isChangePasswordPage) {
    const url = request.nextUrl.clone()
    url.pathname = session.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
    return withOptionalActivityRefresh(request, session, NextResponse.redirect(url))
  }

  // Pendente: só pode ficar em /aguardando-aprovacao
  if (session.status === 'PENDING') {
    if (!isWaitingPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/aguardando-aprovacao'
      return withOptionalActivityRefresh(request, session, NextResponse.redirect(url))
    }
    return withOptionalActivityRefresh(request, session, NextResponse.next())
  }

  // Aprovado/admin na página de espera → área logada
  if (isWaitingPage) {
    const url = request.nextUrl.clone()
    url.pathname = session.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
    return withOptionalActivityRefresh(request, session, NextResponse.redirect(url))
  }

  // Já autenticado em login/cadastro → área logada
  if (isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = session.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
    return withOptionalActivityRefresh(request, session, NextResponse.redirect(url))
  }

  // Aluno não pode acessar /admin
  if (pathname.startsWith('/admin') && session.role !== 'ADMIN') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return withOptionalActivityRefresh(request, session, NextResponse.redirect(url))
  }

  return withOptionalActivityRefresh(request, session, NextResponse.next())
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo\\.png|logo\\.jpg|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
