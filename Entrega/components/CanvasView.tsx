'use client'

import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'

// Canvas do Processo em modo LEITURA (portal do cliente) — só navega/vê.
const Excalidraw = dynamic(() => import('@excalidraw/excalidraw').then(m => m.Excalidraw), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-[12px] text-white/50">carregando…</div>,
})

function parseScene(json: string) {
  try {
    const s = JSON.parse(json)
    return { elements: s.elements || [], appState: { ...(s.appState || {}), collaborators: undefined }, files: s.files || undefined }
  } catch { return undefined }
}

export default function CanvasView({ scene }: { scene: string }) {
  const data = parseScene(scene)
  if (!data) return null
  return (
    <div style={{ height: '70vh' }} className="rounded-xl overflow-hidden border border-white/10">
      <Excalidraw initialData={data} viewModeEnabled />
    </div>
  )
}
