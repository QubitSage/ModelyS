import fs from 'fs'
import path from 'path'
import { atomicWriteFileSync } from './store'
import { CalibRound, CreativeProvider, CriteriaScore } from './types'

// Calibração POR CLIENTE (seção 3): registra cada rodada da Arena associada ao
// cliente. O sinal mais forte é qual direção o usuário escolheu (voto real);
// as notas 1-5 são complemento. O placar por cliente sai daqui e alimenta a
// promoção manual de um modelo a padrão da Direção Criativa daquele cliente.

const FILE = path.join(process.cwd(), 'data', 'creative-calibration.json')

export function listRounds(): CalibRound[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return [] }
}

function writeRounds(rounds: CalibRound[]) {
  atomicWriteFileSync(FILE, JSON.stringify(rounds, null, 2))
}

// upsert por (runId, clientId): reavaliar/reescolher a mesma rodada atualiza.
export function saveRound(round: CalibRound) {
  const rounds = listRounds().filter(r => !(r.runId === round.runId && r.clientId === round.clientId))
  rounds.push(round)
  writeRounds(rounds)
  return round
}

export interface ScoreRow {
  provider: CreativeProvider
  escolhas: number       // quantas vezes a direção deste modelo foi a escolhida
  avaliacoes: number     // quantas rodadas deram nota a este modelo
  originalidade: number
  viabilidade: number
  tom: number
  media: number          // média dos 3 critérios
}

export interface Scoreboard {
  clientId: string
  rodadas: number        // total de rodadas registradas p/ este cliente
  rows: ScoreRow[]       // ordenado por escolhas, depois média
}

const PROVIDERS: CreativeProvider[] = ['sonnet', 'gemini', 'gpt', 'grok']

export function scoreboardFor(clientId: string): Scoreboard {
  const rounds = listRounds().filter(r => r.clientId === clientId)
  const rows: ScoreRow[] = PROVIDERS.map(p => {
    const escolhas = rounds.filter(r => r.escolhido === p).length
    const notas = rounds.map(r => r.notas?.[p]).filter((n): n is CriteriaScore => !!n)
    const n = notas.length
    const sum = notas.reduce((a, s) => ({ o: a.o + s.originalidade, v: a.v + s.viabilidade, t: a.t + s.tom }), { o: 0, v: 0, t: 0 })
    return {
      provider: p,
      escolhas,
      avaliacoes: n,
      originalidade: n ? +(sum.o / n).toFixed(2) : 0,
      viabilidade: n ? +(sum.v / n).toFixed(2) : 0,
      tom: n ? +(sum.t / n).toFixed(2) : 0,
      media: n ? +((sum.o + sum.v + sum.t) / (n * 3)).toFixed(2) : 0,
    }
  }).filter(r => r.escolhas > 0 || r.avaliacoes > 0)
    .sort((a, b) => b.escolhas - a.escolhas || b.media - a.media)
  return { clientId, rodadas: rounds.length, rows }
}

// nº mínimo de rodadas antes de sugerir promover um padrão (configurável)
export const MIN_ROUNDS = Number(process.env.CALIB_MIN_ROUNDS || 5)

export function clearClient(clientId: string) {
  writeRounds(listRounds().filter(r => r.clientId !== clientId))
}
