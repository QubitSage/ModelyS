'use client'

import { useEffect, useRef, useState } from 'react'
import { DeliveryItemStatus } from '@/lib/types'
import CanvasView from './CanvasView'

// Canvas do Processo ainda em teste: só aparece em localhost. Em produção o
// cliente vê o fluxo estruturado (o canvas fica oculto até validarmos.)
function useLocalhost() {
  const [local, setLocal] = useState(false)
  useEffect(() => { setLocal(['localhost', '127.0.0.1'].includes(window.location.hostname)) }, [])
  return local
}

// Portal público de UMA entrega (acesso por slug, sem login). Duas abas:
// Processo (a jornada, estilo canvas) e Aprovação (galeria aprovar/comentar/baixar).

interface PubItem {
  id: string
  tipo: 'imagem' | 'video'
  thumbnail?: string
  status: DeliveryItemStatus
  comentario?: string
  originalName?: string
}
interface PubDirection { rotulo?: string; conceito: string; tom?: string; escolhida?: boolean }
interface PubAudio { id: string; transcript: string; createdAt: string }
export interface PublicDelivery {
  titulo: string
  clienteNome: string
  createdAt: string
  processo: { origem: string; direcoes: PubDirection[]; direcaoEscolhida: string; motivoEscolha: string; qcValidado: boolean; canvas?: string }
  itens: PubItem[]
  audios?: PubAudio[]
}

export default function PortalView({ slug, data }: { slug: string; data: PublicDelivery }) {
  const [tab, setTab] = useState<'processo' | 'aprovacao'>('processo')
  const canvasOn = useLocalhost() // canvas só em localhost por enquanto
  const [itens, setItens] = useState<PubItem[]>(data.itens)
  const [lightbox, setLightbox] = useState<PubItem | null>(null)
  const [toast, setToast] = useState<{ msg: string; tom: 'ok' | 'info' } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [audios, setAudios] = useState<PubAudio[]>(data.audios || [])
  const [recording, setRecording] = useState(false)
  const [recSecs, setRecSecs] = useState(0)
  const [sendingAudio, setSendingAudio] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelRef = useRef(false)

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  async function sendAudio(blob: Blob, filename: string) {
    setSendingAudio(true)
    try {
      const fd = new FormData()
      fd.append('audio', blob, filename)
      const res = await fetch(`/api/public/${slug}/audio`, { method: 'POST', body: fd })
      const j = await res.json()
      if (res.ok) { setAudios(a => [...a, j]); showToast('Recado de áudio enviado ✓', 'ok') }
      else showToast(j.error || 'Não consegui enviar o áudio.', 'info')
    } catch { showToast('Não consegui enviar o áudio.', 'info') }
    setSendingAudio(false)
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []; cancelRef.current = false
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        setRecording(false); setRecSecs(0)
        if (cancelRef.current) return
        const type = rec.mimeType || 'audio/webm'
        sendAudio(new Blob(chunksRef.current, { type }), `recado.${type.includes('mp4') ? 'mp4' : 'webm'}`)
      }
      recRef.current = rec; rec.start(); setRecording(true); setRecSecs(0)
      timerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000)
    } catch {
      showToast('Não consegui acessar o microfone. Libere a permissão do navegador ou anexe um arquivo de áudio.', 'info')
    }
  }
  function stopRec() { cancelRef.current = false; recRef.current?.stop() }
  function cancelRec() { cancelRef.current = true; recRef.current?.stop() }

  async function confirmarRecebimento() {
    setSending(true)
    try {
      await fetch(`/api/public/${slug}/confirm`, { method: 'POST' })
      window.location.reload() // recarrega → cai na tela de "recebimento confirmado"
    } catch {
      setSending(false)
      showToast('Não foi possível confirmar agora. Tente de novo.', 'info')
    }
  }

  function showToast(msg: string, tom: 'ok' | 'info' = 'info') {
    setToast({ msg, tom })
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), 3500)
  }

  const fileUrl = (it: PubItem, dl = false) => `/api/public/${slug}/file/${it.id}${dl ? '?download=1' : ''}`

  async function setStatus(it: PubItem, status: DeliveryItemStatus) {
    const novo = it.status === status ? 'pendente' : status
    setItens(list => list.map(x => (x.id === it.id ? { ...x, status: novo } : x)))
    if (novo === 'aprovado') showToast('Ficamos felizes que aprovou! Já pode baixar em 4K 🎉', 'ok')
    else if (novo === 'reprovado') showToast('Sua resposta foi enviada para nossa equipe.', 'info')
    await fetch(`/api/public/${slug}/items/${it.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: novo }),
    }).catch(() => {})
  }
  async function saveComment(it: PubItem, comentario: string) {
    setItens(list => list.map(x => (x.id === it.id ? { ...x, comentario } : x)))
    if (comentario.trim()) showToast('Seu comentário foi enviado para nossa equipe.', 'info')
    await fetch(`/api/public/${slug}/items/${it.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comentario }),
    }).catch(() => {})
  }

  const aprov = itens.filter(i => i.status === 'aprovado').length
  const repr = itens.filter(i => i.status === 'reprovado').length
  const pend = itens.length - aprov - repr

  return (
    <div className="min-h-screen bg-[#0d0d0c] text-[#e8e6e1]">
      <header className="border-b border-white/10 px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 grid place-items-center text-[13px] font-bold">M</div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-white/40">Entrega · {data.clienteNome}</p>
            <h1 className="text-[18px] font-semibold truncate">{data.titulo}</h1>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {(['processo', 'aprovacao'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-[13px] transition-colors ${tab === t ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
              {t === 'processo' ? 'Processo' : `Aprovação (${itens.length})`}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === 'processo' ? (
          canvasOn && data.processo.canvas ? (
            <div className="space-y-3">
              <CanvasView scene={data.processo.canvas} />
              <button onClick={() => setTab('aprovacao')} className="w-full rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.08] p-3 text-center text-[13px] font-medium transition-colors">
                Ver os {itens.length} {itens.length === 1 ? 'item' : 'itens'} pra aprovar →
              </button>
            </div>
          ) : (
            <ProcessCanvas data={data} onVerItens={() => setTab('aprovacao')} count={itens.length} />
          )
        ) : (
          <>
            <div className="flex items-center gap-4 mb-5 text-[12.5px]">
              <span className="text-[#7bd88f]">✓ {aprov} aprovados</span>
              <span className="text-[#ff6b6b]">✕ {repr} reprovados</span>
              <span className="text-white/50">◔ {pend} pendentes</span>
            </div>
            {itens.length === 0 ? (
              <p className="text-white/50 text-[13px]">Ainda não há itens nesta entrega.</p>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {itens.map(it => (
                  <article key={it.id} className={`rounded-xl overflow-hidden border ${
                    it.status === 'aprovado' ? 'border-[#7bd88f]/60' : it.status === 'reprovado' ? 'border-[#ff6b6b]/50' : 'border-white/10'
                  } bg-white/[0.03]`}>
                    <button onClick={() => setLightbox(it)} className="block w-full aspect-square bg-black/40 relative">
                      {it.thumbnail
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={it.thumbnail} alt={it.originalName || ''} className="w-full h-full object-cover" />
                        : <span className="absolute inset-0 grid place-items-center text-white/30 text-[12px]">{it.tipo === 'video' ? '🎬 vídeo' : 'sem preview'}</span>}
                      {it.tipo === 'video' && <span className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/60">🎬</span>}
                    </button>
                    <div className="p-2.5 space-y-2">
                      <div className="flex gap-1.5">
                        <button onClick={() => setStatus(it, 'aprovado')} className={`flex-1 text-[11.5px] py-1 rounded-lg ${it.status === 'aprovado' ? 'bg-[#7bd88f] text-black font-medium' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>✓ Aprovar</button>
                        <button onClick={() => setStatus(it, 'reprovado')} className={`flex-1 text-[11.5px] py-1 rounded-lg ${it.status === 'reprovado' ? 'bg-[#ff6b6b] text-black font-medium' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>✕ Reprovar</button>
                      </div>
                      <input
                        defaultValue={it.comentario || ''}
                        onBlur={e => e.target.value !== (it.comentario || '') && saveComment(it, e.target.value)}
                        placeholder="comentário (opcional)"
                        className="w-full text-[11.5px] rounded-lg bg-black/30 border border-white/10 px-2 py-1.5 outline-none focus:border-white/30 placeholder:text-white/25"
                      />
                      <a href={fileUrl(it, true)} className="block text-center text-[11px] py-1 rounded-lg bg-white/5 text-white/70 hover:bg-white/10">⬇ baixar em 4K</a>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Recado em áudio → chega transcrito pra equipe */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.015] p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 grid place-items-center text-[18px] shrink-0">🎙</div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">Prefere falar? Deixe um recado</p>
                  <p className="text-[12px] text-white/50">Grave um áudio — ele chega <b className="text-white/75">transcrito</b> pra nossa equipe.</p>
                </div>
              </div>

              <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) sendAudio(f, f.name); e.target.value = '' }} />

              {!recording ? (
                <div className="flex gap-2 mt-4">
                  <button onClick={startRec} disabled={sendingAudio} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ff5c5c] text-white text-[13.5px] font-semibold hover:bg-[#ff7070] disabled:opacity-50 transition-colors">
                    <span className="w-2.5 h-2.5 rounded-full bg-white" /> Gravar áudio
                  </button>
                  <button onClick={() => audioInputRef.current?.click()} disabled={sendingAudio} title="Anexar arquivo de áudio" className="px-4 py-3 rounded-xl bg-white/5 text-white/70 text-[15px] hover:bg-white/10 disabled:opacity-50 transition-colors">📎</button>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-black/40 border border-[#ff5c5c]/30 p-3">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#ff5c5c] opacity-60 animate-ping" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff5c5c]" />
                  </span>
                  <span className="text-[15px] font-mono tabular-nums">{fmtSecs(recSecs)}</span>
                  <span className="text-[12px] text-white/45 max-sm:hidden">gravando…</span>
                  <div className="ml-auto flex gap-2">
                    <button onClick={cancelRec} className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-[12px] hover:bg-white/15">Cancelar</button>
                    <button onClick={stopRec} className="px-3.5 py-1.5 rounded-lg bg-white text-black text-[12px] font-semibold">Parar e enviar</button>
                  </div>
                </div>
              )}

              {sendingAudio && (
                <div className="mt-3 flex items-center gap-2 text-[12.5px] text-white/55">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/25 border-t-white animate-spin" /> enviando…
                </div>
              )}

              {audios.length > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#7bd88f]/10 border border-[#7bd88f]/25 p-3 text-[13px] text-[#7bd88f]">
                  ✓ {audios.length === 1 ? 'Recado enviado' : `${audios.length} recados enviados`} — nossa equipe já recebeu.
                </div>
              )}
            </div>

            {/* Finalizar: confirma o recebimento e libera o espaço do servidor */}
            {itens.length > 0 && (
              <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                <p className="text-[13px] text-white/70">Terminou de baixar tudo o que precisa?</p>
                <button
                  onClick={() => setConfirming(true)}
                  className="mt-3 px-5 py-2.5 rounded-xl bg-[#7bd88f] text-black text-[13px] font-semibold hover:bg-[#8fe0a1] transition-colors"
                >
                  ✓ Confirmar recebimento e finalizar
                </button>
                <p className="text-[11px] text-white/35 mt-2">Ao confirmar, o conteúdo é removido do site para liberar espaço.</p>
              </div>
            )}
          </>
        )}
      </main>

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl text-[13px] shadow-lg max-w-[90vw] text-center ${
          toast.tom === 'ok' ? 'bg-[#7bd88f] text-black' : 'bg-white text-black'
        }`}>{toast.msg}</div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-[70] bg-black/80 grid place-items-center p-6" onClick={() => !sending && setConfirming(false)}>
          <div className="max-w-md w-full rounded-2xl border border-white/15 bg-[#161615] p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full bg-[#ff6b6b]/15 text-[#ff6b6b] grid place-items-center text-xl mx-auto mb-3">⚠</div>
            <p className="text-[16px] font-semibold">Você tem certeza que o material está aprovado?</p>
            <p className="text-[13px] text-white/60 mt-2">
              Uma vez confirmado, <b className="text-white/80">todo o conteúdo desta entrega será removido do site</b> para liberar espaço para outras entregas. Essa ação não tem volta.
            </p>
            <p className="text-[12px] text-white/45 mt-2">Baixe tudo o que precisar <b>antes</b> de confirmar.</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setConfirming(false)} disabled={sending} className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-[13px] hover:bg-white/15 disabled:opacity-50">Cancelar</button>
              <button onClick={confirmarRecebimento} disabled={sending} className="flex-1 py-2.5 rounded-xl bg-[#ff6b6b] text-black text-[13px] font-semibold hover:bg-[#ff8080] disabled:opacity-50">
                {sending ? 'Confirmando…' : 'Confirmar e finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 grid place-items-center p-6" onClick={() => setLightbox(null)}>
          <div className="max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            {lightbox.tipo === 'video'
              ? <video src={fileUrl(lightbox)} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={fileUrl(lightbox)} alt={lightbox.originalName || ''} className="max-w-full max-h-[85vh] rounded-lg object-contain" />}
            <div className="flex justify-center gap-2 mt-3">
              <a href={fileUrl(lightbox, true)} className="text-[12px] px-3 py-1.5 rounded-lg bg-white text-black">⬇ baixar em 4K</a>
              <button onClick={() => setLightbox(null)} className="text-[12px] px-3 py-1.5 rounded-lg bg-white/10 text-white">fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Aba Processo: a jornada, estilo canvas (cards conectados) ----
function ProcessCanvas({ data, onVerItens, count }: { data: PublicDelivery; onVerItens: () => void; count: number }) {
  const p = data.processo
  const temProcesso = p.origem || p.direcaoEscolhida || p.direcoes.length
  const Arrow = () => <div className="flex justify-center my-1"><span className="text-white/25 text-lg">↓</span></div>

  if (!temProcesso) {
    return <p className="text-white/50 text-[13px]">O processo desta entrega ainda não foi preenchido.</p>
  }
  return (
    <div className="max-w-xl mx-auto">
      <p className="text-center text-[12px] text-white/40 mb-4">O caminho até este resultado</p>

      {p.origem && (
        <>
          <Node cor="#8ab4f8" etapa="Ponto de partida">{p.origem}</Node>
          <Arrow />
        </>
      )}

      {p.direcoes.length > 0 && (
        <>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Direções consideradas</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {p.direcoes.map((d, i) => (
                <div key={i} className={`rounded-lg p-2 border text-[11.5px] ${d.escolhida ? 'border-[#7bd88f]/60 bg-[#7bd88f]/10' : 'border-white/10 bg-black/20 opacity-70'}`}>
                  <div className="flex items-center gap-1 mb-0.5">
                    {d.rotulo && <span className="text-[9px] uppercase tracking-wide text-white/40">{d.rotulo}</span>}
                    {d.escolhida ? <span className="ml-auto text-[9px] text-[#7bd88f]">escolhida</span> : <span className="ml-auto text-[9px] text-white/30">descartada</span>}
                  </div>
                  <p className="leading-snug">{d.conceito}</p>
                </div>
              ))}
            </div>
          </div>
          <Arrow />
        </>
      )}

      {p.direcaoEscolhida && (
        <>
          <Node cor="#7bd88f" etapa="Direção escolhida">
            <p className="font-medium">{p.direcaoEscolhida}</p>
            {p.motivoEscolha && <p className="text-white/60 text-[12px] mt-1">Por quê: {p.motivoEscolha}</p>}
          </Node>
          <Arrow />
        </>
      )}

      {p.qcValidado && (
        <>
          <div className="rounded-xl border border-[#7bd88f]/40 bg-[#7bd88f]/5 p-3 text-[12.5px] flex items-center gap-2">
            <span className="text-[#7bd88f]">🛡</span> Material validado pelo controle de qualidade (QC) — segurança de marca conferida.
          </div>
          <Arrow />
        </>
      )}

      <button onClick={onVerItens} className="w-full rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.08] p-4 text-center transition-colors">
        <p className="text-[10px] uppercase tracking-widest text-white/40">Resultado final</p>
        <p className="text-[14px] font-medium mt-0.5">Ver os {count} {count === 1 ? 'item' : 'itens'} pra aprovar →</p>
      </button>
    </div>
  )
}

function Node({ cor, etapa, children }: { cor: string; etapa: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: cor }} />
      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1 pl-1.5">{etapa}</p>
      <div className="text-[13px] pl-1.5">{children}</div>
    </div>
  )
}
