'use client'

import { useRef, useState } from 'react'

export interface AttachedFile { name: string; dataUrl: string; mimeType: string }

async function toFile(f: File): Promise<AttachedFile | null> {
  if (f.size > 40 * 1024 * 1024) return null // 40MB por arquivo
  const dataUrl = await new Promise<string>(res => {
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f)
  })
  return { name: f.name || 'arquivo', dataUrl, mimeType: f.type || 'application/octet-stream' }
}

function icon(m: string) {
  if (m.startsWith('image/')) return '🖼'
  if (m.startsWith('video/')) return '🎬'
  if (m.startsWith('audio/')) return '🎵'
  if (m.includes('pdf')) return '📄'
  return '📎'
}

// Anexo de N arquivos de QUALQUER tipo (imagem/PDF/vídeo/áudio/doc), drag-n-drop
// ou clique. Usado pela Direção Criativa e pela Arena pra intermediar referência.
export default function FileDrop({ files, onChange, hint }: {
  files: AttachedFile[]
  onChange: (f: AttachedFile[]) => void
  hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [warn, setWarn] = useState('')

  async function add(list: FileList | File[] | null) {
    if (!list) return
    const out: AttachedFile[] = []
    let skipped = 0
    for (const f of Array.from(list)) { const a = await toFile(f); if (a) out.push(a); else skipped++ }
    setWarn(skipped ? `${skipped} arquivo(s) acima de 40MB ignorado(s).` : '')
    if (out.length) onChange([...files, ...out])
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
    >
      <input ref={ref} type="file" multiple className="hidden" onChange={e => { add(e.target.files); e.target.value = '' }} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`w-full text-left rounded-lg border border-dashed px-3 py-2 text-[11.5px] ${drag ? 'border-[var(--accent)] bg-[var(--panel-2)] text-[var(--text)]' : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--text-3)]'}`}
      >
        📎 {hint || 'anexar referências — imagem, PDF, vídeo, áudio, doc… (arraste vários ou clique)'}
      </button>
      {warn && <p className="text-[11px] text-[var(--red)] mt-1">{warn}</p>}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-[var(--panel-2)]">
              <span>{icon(f.mimeType)}</span>
              <span className="max-w-[130px] truncate">{f.name}</span>
              <button onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-[var(--text-3)] hover:text-[var(--red)]">✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
