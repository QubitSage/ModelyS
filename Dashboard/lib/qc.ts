// QC determinístico do pacote de produção — roda ANTES de colar no Flow.
// Alinhado ao formato scaffold v3 (Omni Flash): placeholders [Nome] são
// OBRIGATÓRIOS (não erro), fala aparece UMA vez, timestamps só relativos ao
// take, sem boilerplate de negative prompt.

import { QCFinding, QCResult } from './types'

// ---------------------------------------------------------------------------
// Blocklist de política — gatilhos conhecidos do filtro do Omni/Flow.
// A lista do cliente (client.qcBlocklist) soma a esta.
// ---------------------------------------------------------------------------
const DEFAULT_BLOCKLIST: Array<{ termo: string; motivo: string }> = [
  { termo: 'news anchor', motivo: 'simula telejornal real — gatilho clássico do filtro' },
  { termo: 'breaking news', motivo: 'simula telejornal real — gatilho clássico do filtro' },
  { termo: 'broadcast studio', motivo: 'simula telejornal real — use "content studio"' },
  { termo: 'live report', motivo: 'simula cobertura ao vivo — use "educational talking-head"' },
  { termo: 'newsroom', motivo: 'simula redação de jornal real' },
  { termo: 'CNN', motivo: 'marca de emissora real' },
  { termo: 'BBC', motivo: 'marca de emissora real' },
  { termo: 'match face', motivo: 'instrução de deepfake — bloqueio garantido' },
  { termo: 'deepfake', motivo: 'bloqueio garantido' },
  { termo: 'teen', motivo: 'idade ambígua/menor — pessoas devem ser explicitamente adultas' },
  { termo: 'teenager', motivo: 'menor de idade — bloqueio' },
  { termo: 'school', motivo: 'contexto escolar dispara filtro de menores' },
  { termo: 'schoolgirl', motivo: 'bloqueio garantido' },
  { termo: 'child', motivo: 'menor de idade em prompt de pessoa — risco alto' },
  { termo: 'guaranteed returns', motivo: 'promessa de enriquecimento — parece scam pro filtro' },
  { termo: 'get rich fast', motivo: 'promessa de enriquecimento — parece scam pro filtro' },
  { termo: 'AI-generated', motivo: 'quebra o ultrarrealismo — trate pessoas como reais fotografadas' },
  { termo: 'digital human', motivo: 'quebra o ultrarrealismo — trate pessoas como reais fotografadas' },
]

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// ---------------------------------------------------------------------------
// Teto de palavras por duração de fala (PT-BR natural, validado em produção):
// 4s→10, 6s→14, 8s→18, 10s→23. Interpolação linear entre âncoras.
// ---------------------------------------------------------------------------
const WORD_CAP_ANCHORS: Array<[number, number]> = [[4, 10], [6, 14], [8, 18], [10, 23]]

export function wordCap(durationS: number): number {
  if (durationS <= WORD_CAP_ANCHORS[0][0]) {
    return Math.max(1, Math.round((durationS / WORD_CAP_ANCHORS[0][0]) * WORD_CAP_ANCHORS[0][1]))
  }
  for (let i = 0; i < WORD_CAP_ANCHORS.length - 1; i++) {
    const [d0, c0] = WORD_CAP_ANCHORS[i]
    const [d1, c1] = WORD_CAP_ANCHORS[i + 1]
    if (durationS <= d1) return Math.round(c0 + ((durationS - d0) / (d1 - d0)) * (c1 - c0))
  }
  const [dMax, cMax] = WORD_CAP_ANCHORS[WORD_CAP_ANCHORS.length - 1]
  return Math.round(cMax + (durationS - dMax) * 2.3)
}

// ---------------------------------------------------------------------------
// Parse do pacote
// ---------------------------------------------------------------------------
interface ParsedTake {
  label: string
  start: number | null
  end: number | null
  lines: string[]
  shots: number // planos internos: headers "Shot" legados + marcadores [0-3s]
  falas: string[]
}

function parseTimePoint(s: string): number | null {
  const t = s.trim()
  const mmss = t.match(/^(\d+):(\d+(?:\.\d+)?)$/)
  if (mmss) return parseInt(mmss[1]) * 60 + parseFloat(mmss[2])
  const secs = t.match(/^(\d+(?:[.,]\d+)?)\s*s?$/)
  if (secs) return parseFloat(secs[1].replace(',', '.'))
  return null
}

const TAKE_HEADER = /^#{2,6}\s*\**\s*(Take|Parte|Cena)\s*(\d+)[^(\n]*\(([^)]*)\)/i
const SHOT_HEADER = /^#{2,6}\s*\**\s*Shot\s+[A-Z0-9]/i
// marcador de plano interno relativo ao take: [0-3s], [3-8s]
const INTERNAL_SHOT = /\[(\d{1,2})\s*[-–]\s*(\d{1,2})\s*s\]/g
// timestamp absoluto do vídeo (formato MM:SS) dentro do conteúdo — erro no Omni
const ABSOLUTE_TS = /\[(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\]/

export function parseTakes(content: string): ParsedTake[] {
  const takes: ParsedTake[] = []
  let current: ParsedTake | null = null

  for (const line of content.split('\n')) {
    const m = line.match(TAKE_HEADER)
    if (m) {
      if (current) takes.push(current)
      let start: number | null = null
      let end: number | null = null
      const range = m[3].match(/([\d:.,]+\s*s?)\s*[–\-—a]+\s*([\d:.,]+\s*s?)/)
      if (range) {
        start = parseTimePoint(range[1])
        end = parseTimePoint(range[2])
      } else {
        const dur = m[3].match(/(\d+(?:[.,]\d+)?)\s*s/)
        if (dur) { start = 0; end = parseFloat(dur[1].replace(',', '.')) }
      }
      current = { label: `${m[1]} ${m[2]}`, start, end, lines: [], shots: 0, falas: [] }
      continue
    }
    if (!current) continue
    current.lines.push(line)
    if (SHOT_HEADER.test(line)) current.shots++

    // Fala no scaffold ("Fala: ...") ou legado ("* **Fala:** ...")
    if (/^\s*(?:[*\-]\s*)?\**\s*Fala\b/i.test(line)) {
      const quoted = line.match(/["“”']([^"“”']{3,})["“”']/)
      if (quoted) current.falas.push(quoted[1])
      else {
        const after = line.replace(/^[^:]*:/, '').trim()
        if (after && after.length > 3 && !/^(n\/a|—|-|\[\.{3}\]|\[\.\.\.\])$/i.test(after)) current.falas.push(after)
      }
    }
    const veoSpeech = line.match(/(?:diz|speaks?)\s+(?:em|in)\s+(?:português|portuguese|Brazilian Portuguese)[^:"“]*[:,]?\s*["“]([^"”]+)["”]/i)
    if (veoSpeech && !/^\s*(?:[*\-]\s*)?\**\s*Fala\b/i.test(line)) current.falas.push(veoSpeech[1])
  }
  if (current) takes.push(current)

  // conta planos internos por marcadores [N-Ms] (formato v3)
  for (const t of takes) {
    const body = t.lines.join('\n')
    const markers = [...body.matchAll(INTERNAL_SHOT)].length
    t.shots = Math.max(t.shots, markers)
  }
  return takes
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------
export function runQC(content: string, clientBlocklist: string[] = []): QCResult {
  const findings: QCFinding[] = []
  const takes = parseTakes(content)

  // 1. Blocklist de política — no bloco inteiro de cada take (scaffold: tudo vai pro Flow)
  const scanTargets = takes.length
    ? takes.map(t => ({ take: t.label, text: t.lines.join('\n') }))
    : [{ take: '', text: content }]

  const blocklist = [
    ...DEFAULT_BLOCKLIST,
    ...clientBlocklist.map(t => ({ termo: t, motivo: 'termo já bloqueado pelo Flow para este cliente' })),
  ]
  for (const { take, text } of scanTargets) {
    const norm = normalize(text)
    for (const b of blocklist) {
      const pattern = new RegExp(`(?<![\\w-])${normalize(b.termo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i')
      const m = pattern.exec(norm)
      // negação legítima não flagra: "no music", "sem música", "avoid X"
      const negated = m ? /(?:no|without|sem|avoid|never)\s*$/.test(norm.slice(Math.max(0, m.index - 10), m.index)) : false
      if (m && !negated) {
        findings.push({
          severidade: 'flagado',
          regra: 'blocklist',
          take: take || undefined,
          motivo: `Termo de bloqueio "${b.termo}" no take — ${b.motivo}.`,
          sugestao: 'Reescrever com alternativa segura antes de colar no Flow.',
        })
      }
    }
  }

  for (const take of takes) {
    const dur = take.start !== null && take.end !== null ? take.end - take.start : null
    const body = take.lines.join('\n')

    // 2. Fala vs duração (fala bugada)
    if (dur !== null && dur > 0) {
      const cap = wordCap(dur)
      for (const fala of take.falas) {
        const words = fala.trim().split(/\s+/).filter(Boolean).length
        if (words > cap) {
          findings.push({
            severidade: 'flagado',
            regra: 'fala-vs-duracao',
            take: take.label,
            motivo: `Fala com ${words} palavras num take de ${dur.toFixed(0)}s (teto: ${cap}) — não fecha no gerador ("${fala.slice(0, 50)}…").`,
            sugestao: 'Encurtar a fala ou transbordar pro take seguinte (nunca esticar o take).',
          })
        } else if (words > cap - 2 && words > 5) {
          findings.push({
            severidade: 'ambiguo',
            regra: 'fala-vs-duracao',
            take: take.label,
            motivo: `Fala com ${words} palavras em ${dur.toFixed(0)}s — no limite do teto (${cap}); ritmo pode ficar apressado.`,
          })
        }
      }
    }

    // 3. Fala duplicada no take (aparecia 2x no formato antigo)
    const seenFalas = new Map<string, number>()
    for (const f of take.falas) {
      const k = normalize(f).slice(0, 60)
      seenFalas.set(k, (seenFalas.get(k) || 0) + 1)
    }
    for (const [k, n] of seenFalas) {
      if (n > 1) {
        findings.push({
          severidade: 'flagado',
          regra: 'fala-duplicada',
          take: take.label,
          motivo: `A mesma fala aparece ${n}× no take — no scaffold a fala vai UMA vez, na linha Fala.`,
          sugestao: 'Remover a duplicata; manter só a linha Fala.',
        })
        void k
      }
    }

    // 4. Densidade de shots: multishot ilustrando a fala é DESEJADO, mas ~1 a
    //    cada 2s (LEI 1A). Teto = ceil(dur/2): 4s→2, 6s→3, 8s→4, 10s→5.
    //    Passou disso = picotado demais (o "4 cuts em 4s").
    if (dur !== null && dur > 0 && take.shots > 0) {
      const maxShots = Math.ceil(dur / 2)
      if (take.shots > maxShots) {
        findings.push({
          severidade: 'flagado',
          regra: 'shots-densos',
          take: take.label,
          motivo: `${take.shots} shots num take de ${dur.toFixed(0)}s (teto ~${maxShots}, ≈1 corte a cada 2s) — picotado demais pro gerador.`,
          sugestao: 'Reduzir os shots ou transbordar parte pro take seguinte.',
        })
      }
    }

    // 5. Timestamp absoluto do vídeo dentro do take ([00:40-00:43]) — o modelo
    //    só conhece o take atual
    const abs = body.match(ABSOLUTE_TS)
    if (abs) {
      findings.push({
        severidade: 'flagado',
        regra: 'timestamp-absoluto',
        take: take.label,
        motivo: `Timestamp do vídeo inteiro (${abs[0]}) dentro do take — o Omni só conhece a geração atual; use tempo relativo ([0-3s]) e só quando houver 2+ planos.`,
        sugestao: 'Trocar por tempo relativo ao take ou remover.',
      })
    }

    // 6. Boilerplate do formato antigo (Veo) — não existe no Omni
    if (/negative prompt\s*:/i.test(body)) {
      findings.push({
        severidade: 'flagado',
        regra: 'boilerplate-veo',
        take: take.label,
        motivo: 'Linha "Negative prompt:" — não existe negative prompt no Omni Flash.',
        sugestao: 'Remover; negativa necessária vai como frase natural no campo certo.',
      })
    }
    if (/that'?s where the camera is/i.test(body)) {
      findings.push({
        severidade: 'ambiguo',
        regra: 'boilerplate-veo',
        take: take.label,
        motivo: '"(that\'s where the camera is)" é truque do Veo — desnecessário no Omni.',
        sugestao: 'Remover a expressão.',
      })
    }
    if (/no subtitles, no captions/i.test(body)) {
      findings.push({
        severidade: 'ambiguo',
        regra: 'boilerplate-veo',
        take: take.label,
        motivo: 'Boilerplate "No subtitles, no captions…" em todo take — não é necessário no Omni; use só quando o projeto pedir.',
        sugestao: 'Remover o boilerplate.',
      })
    }

    // 7. Intervalo inválido no header
    if (take.start !== null && take.end !== null && take.end <= take.start) {
      findings.push({
        severidade: 'flagado',
        regra: 'grade-takes',
        take: take.label,
        motivo: `Intervalo inválido (${take.start}s–${take.end}s): fim antes do início.`,
      })
    }
  }

  const status = findings.some(f => f.severidade === 'flagado')
    ? 'flagado'
    : findings.length > 0
      ? 'ambiguo'
      : 'aprovado'

  return { status, takes: takes.length, findings }
}
