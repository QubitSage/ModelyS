import { NextRequest, NextResponse } from 'next/server'

// Roteamento por host + auth do dashboard.
//  - Host público (modely.com.br): serve o REEL na raiz (/ → /reel) e o portal
//    de entrega — /[slug] é reescrito pra /e/[slug]; qualquer rota interna é
//    bloqueada.
//  - Host do dashboard (dashboard.modely.com.br / fly.dev): app interno, exige
//    login por senha (cookie). Portal público (/e, /api/public) fica livre.
//  - Auth só liga quando DASHBOARD_PASSWORD existe — sem ela, tudo aberto (dev).

const PUBLIC_HOSTS = (process.env.PUBLIC_HOSTS || 'modely.com.br,www.modely.com.br')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const COOKIE = 'modely_auth'

function isPublicRoute(p: string) {
  return p.startsWith('/e/') || p.startsWith('/api/public/')
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase()
  const { pathname } = req.nextUrl

  // assets do Next sempre livres (em qualquer host)
  if (pathname.startsWith('/_next')) return NextResponse.next()

  // ---- domínio público: só o portal ----
  if (PUBLIC_HOSTS.includes(host)) {
    if (isPublicRoute(pathname)) return NextResponse.next()
    if (pathname.startsWith('/api/')) return new NextResponse('not found', { status: 404 })
    // home pública = o reel (mora em /reel; a raiz reescreve pra lá)
    if (pathname === '/' || pathname === '/reel') {
      const url = req.nextUrl.clone(); url.pathname = '/reel'
      return NextResponse.rewrite(url)
    }
    const slug = pathname.slice(1)
    if (/^[a-z0-9-]+$/i.test(slug)) {
      const url = req.nextUrl.clone(); url.pathname = `/e/${slug}`
      return NextResponse.rewrite(url)
    }
    return new NextResponse('not found', { status: 404 })
  }

  // ---- dashboard: auth ----
  // sempre livres: healthcheck do Fly, portal público, tela/rota de login
  const alwaysFree = pathname === '/api/health' || isPublicRoute(pathname) || pathname === '/login' || pathname === '/api/login'

  // FAIL-CLOSED (F-01): em produção, sem DASHBOARD_PASSWORD+AUTH_SECRET, o
  // dashboard NÃO abre — nega tudo (menos as rotas sempre-livres). Em dev fica
  // aberto pra facilitar o desenvolvimento local.
  const authConfigured = !!process.env.DASHBOARD_PASSWORD && !!process.env.AUTH_SECRET
  if (!authConfigured) {
    if (process.env.NODE_ENV === 'production' && !alwaysFree) {
      return new NextResponse('Indisponível: autenticação não configurada.', { status: 503 })
    }
    return NextResponse.next()
  }

  if (alwaysFree) return NextResponse.next()

  const ok = req.cookies.get(COOKIE)?.value === process.env.AUTH_SECRET
  if (ok) return NextResponse.next()

  if (pathname.startsWith('/api/')) return new NextResponse('unauthorized', { status: 401 })
  const url = req.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
