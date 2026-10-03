import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Get the profile if user exists
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()
    profile = data
  }

  const pathname = request.nextUrl.pathname

  // Public routes
  const publicRoutes = ['/login', '/cadastro']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If authenticated
  if (user && profile) {
    // Blocked users - redirect to login with error
    if (profile.status === 'BLOCKED') {
      // Sign out blocked user
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'blocked')
      return NextResponse.redirect(url)
    }

    // Pending users can only access the waiting page
    if (profile.status === 'PENDING') {
      if (pathname !== '/aguardando-aprovacao' && !isPublicRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/aguardando-aprovacao'
        return NextResponse.redirect(url)
      }
    }

    // Approved users should not see the waiting page
    if (profile.status === 'APPROVED' && pathname === '/aguardando-aprovacao') {
      const url = request.nextUrl.clone()
      url.pathname = profile.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
      return NextResponse.redirect(url)
    }

    // Admin route protection
    if (pathname.startsWith('/admin') && profile.role !== 'ADMIN') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from login/register
    if (isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = profile.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
