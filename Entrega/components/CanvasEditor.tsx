'use client'

import { useRef } from 'react'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

// Editor de canvas do Processo (interno) — Excalidraw carregado só no cliente.
const Excalidraw = dynamic(() => import('@excalidraw/excalidraw').then(m => m.Excalidraw), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-[12px] text-[var(--text-2)]">carregando canvas…</div>,
})

function parseScene(json?: string) {
  if (!json) return undefined
  try {
    const s = JSON.parse(json)
    // Excalidraw guarda collaborators como Map às vezes; sanea o appState.
    return { elements: s.elements || [], appState: { ...(s.appState || {}), collaborators: undefined }, files: s.files || undefined }
  } catch { return undefined }
}

export default function CanvasEditor({ initial, onChange }: { initial?: string; onChange: (scene: string) => void }) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleSave() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const api = apiRef.current
      if (!api) return
      const scene = {
        elements: api.getSceneElements(),
        appState: { viewBackgroundColor: api.getAppState().viewBackgroundColor },
        files: api.getFiles(),
      }
      onChange(JSON.stringify(scene))
    }, 1200) // debounce: Excalidraw dispara onChange muito
  }

  return (
    <div style={{ height: 480 }} className="rounded-lg overflow-hidden border border-[var(--border)]">
      <Excalidraw
        excalidrawAPI={api => { apiRef.current = api }}
        initialData={parseScene(initial)}
        onChange={scheduleSave}
      />
    </div>
  )
}
