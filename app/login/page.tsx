'use client'

import { useState } from 'react'

// Tela de login do dashboard (senha única).
export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErro('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      })
      if (res.ok) {
        // F-05: evita open redirect — só caminho interno (um único "/" inicial)
        const raw = new URLSearchParams(window.location.search).get('next')
        const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
        window.location.href = next
      } else {
        setErro((await res.json().catch(() => ({}))).error || 'senha incorreta')
      }
    } catch { setErro('falha na conexão') } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0c] text-[#e8e6e1] grid place-items-center p-6">
      <form onSubmit={entrar} className="w-[300px] space-y-3">
        <div className="flex items-center gap-2 justify-center mb-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 grid place-items-center text-[13px] font-bold">M</div>
          <span className="font-semibold text-[15px]">Modely</span>
        </div>
        <input
          type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)}
          placeholder="senha do dashboard"
          className="w-full text-[13px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 outline-none focus:border-white/40"
        />
        {erro && <p className="text-[12px] text-[#ff6b6b]">{erro}</p>}
        <button type="submit" disabled={busy || !password} className="w-full py-2 rounded-lg bg-white text-black text-[13px] font-medium disabled:opacity-40">
          {busy ? 'entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
