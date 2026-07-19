import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Login por senha única. Confere DASHBOARD_PASSWORD e seta o cookie de sessão
// (valor = AUTH_SECRET, httpOnly) que o middleware valida.

// F-03: rate limit simples em memória (por instância) — trava força-bruta.
const attempts = new Map<string, { count: number; ts: number }>()
const WINDOW_MS = 5 * 60 * 1000
const MAX_TRIES = 8
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const e = attempts.get(ip)
  if (!e || now - e.ts > WINDOW_MS) { attempts.set(ip, { count: 1, ts: now }); return false }
  e.count++
  return e.count > MAX_TRIES
}

// F-04: comparação em tempo constante (via hash de tamanho fixo).
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

export async function POST(request: Request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local'
  if (rateLimited(ip)) return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })

  const { password } = await request.json().catch(() => ({ password: '' }))
  const expected = process.env.DASHBOARD_PASSWORD
  const secret = process.env.AUTH_SECRET
  // F-02: sem fallback 'ok' — exige as duas variáveis configuradas.
  if (!expected || !secret) return NextResponse.json({ error: 'login não configurado' }, { status: 400 })
  if (!password || !safeEqual(String(password), expected)) return NextResponse.json({ error: 'senha incorreta' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('modely_auth', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // F-02: 7 dias (antes 90)
  })
  return res
}

// logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('modely_auth', '', { path: '/', maxAge: 0 })
  return res
}
