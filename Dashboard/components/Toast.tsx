'use client'

// Toasts globais mínimos — event emitter module-level, sem lib.
// pushToast('✓ pronto', 'success') de qualquer componente.

import { useEffect, useState } from 'react'

type Kind = 'info' | 'success' | 'error' | 'loading'
interface Toast { id: number; text: string; kind: Kind; sticky?: boolean }

type Listener = (t: Toast[]) => void
let toasts: Toast[] = []
const listeners = new Set<Listener>()
let seq = 1

function emit() {
  for (const l of listeners) l([...toasts])
}

export function pushToast(text: string, kind: Kind = 'info', opts?: { sticky?: boolean; id?: number }): number {
  const id = opts?.id ?? seq++
  toasts = toasts.filter(t => t.id !== id)
  toasts.push({ id, text, kind, sticky: opts?.sticky })
  emit()
  if (!opts?.sticky) setTimeout(() => dismissToast(id), kind === 'error' ? 6000 : 3500)
  return id
}

export function dismissToast(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

const STYLE: Record<Kind, string> = {
  info: 'border-[var(--border)] bg-[var(--panel)]',
  success: 'border-[var(--green)] bg-[var(--green-bg)] text-[var(--green)]',
  error: 'border-[var(--red)] bg-[var(--red-bg)] text-[var(--red)]',
  loading: 'border-[var(--border)] bg-[var(--panel)]',
}

export function Toasts() {
  const [list, setList] = useState<Toast[]>([])
  useEffect(() => {
    const l: Listener = setList
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-[320px]">
      {list.map(t => (
        <div key={t.id} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] shadow-lg ${STYLE[t.kind]}`}>
          {t.kind === 'loading' && <span className="w-3 h-3 rounded-full border-2 border-[var(--border)] border-t-[var(--green)] animate-spin shrink-0" />}
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismissToast(t.id)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  )
}
