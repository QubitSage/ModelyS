// Domínio do Modely — enxuto: produção (chat), QC, biblioteca, CRM/custos.

export type Mode = 'producao' | 'visual' | 'revisao' | 'web'
export type ModelChoice = 'auto' | 'gemini' | 'claude'

export interface Ref {
  id: string
  name: string // ex: [Homem], [Óculos]
  dataUrl: string // base64 inline
  mimeType: string
  briefing?: string
}

export interface Attachment {
  id: string
  name: string
  type: string
  dataUrl?: string
  mimeType: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  attachments?: Attachment[]
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  model?: string
  qc?: QCResult // QC automático rodado ao salvar respostas com takes
  editedTakes?: string[] // labels de takes corrigidos pós-entrega ("Take 6")
}

export interface ThreadContext {
  briefing: string
  notes: string
  refs: Ref[]
  previousSummary?: string
}

export interface Thread {
  id: string
  clientId: string
  name: string
  mode: Mode
  createdAt: string
  messages: Message[]
  context: ThreadContext
  model?: ModelChoice
}

export interface MemoryItem {
  id: string
  title: string
  content: string
  createdAt: string
}

// ---- CRM ----
export type DealStage = 'lead' | 'proposta' | 'fechado' | 'producao' | 'revisao' | 'entregue' | 'arquivado'

export interface Deal {
  id: string
  title: string
  stage: DealStage
  contractBrl: number
  paidBrl: number
  followUpDate?: string
  deliveryDate?: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string
  name: string
  email?: string
  whatsapp?: string
  role?: string
}

export interface Activity {
  id: string
  kind: 'nota' | 'ligacao' | 'reuniao' | 'email' | 'whatsapp' | 'entrega' | 'pagamento'
  text: string
  timestamp: string
  dealId?: string
}

// Modelos da Direção Criativa / Arena (compartilhado entre lib e store sem
// import circular).
export type CreativeProvider = 'sonnet' | 'gemini' | 'gpt' | 'grok'

export interface CriteriaScore {
  originalidade: number // 1-5
  viabilidade: number   // 1-5 (viável no Flow)
  tom: number           // 1-5 (aderência ao tom do cliente)
}

// Uma rodada de Arena, registrada por cliente (seção 3). O voto real (escolhido)
// é o sinal mais forte; as notas são opcionais.
export interface CalibRound {
  runId: string
  clientId: string // '' = sem cliente (ideia genérica)
  date: string
  idea: string     // resumo curto
  escolhido: CreativeProvider | null
  notas?: Partial<Record<CreativeProvider, CriteriaScore>>
  taskTag?: string // tag de tipo de conteúdo (reservado p/ calibração fina futura)
}

export interface Client {
  id: string
  name: string
  createdAt: string
  threads: Thread[]
  memory: MemoryItem[]
  injectMemory: boolean
  defaultModel?: 'gemini' | 'claude' // modelo padrão do chat p/ este cliente
  creativeDefault?: CreativeProvider // modelo calibrado da Direção Criativa (seção 3)
  // QC por cliente
  qcBlocklist?: string[] // termos extras que o Flow já bloqueou pra este cliente
  rules?: string // regras invioláveis do cliente — entram com prioridade máxima em toda conversa
  // CRM
  company?: string
  segment?: string
  crmNotes?: string
  tags?: string[]
  contacts?: Contact[]
  deals?: Deal[]
  activities?: Activity[]
}

export interface ClientIndex {
  id: string
  name: string
  createdAt: string
  threadCount: number
}

// ---- QC ----
export type QCSeverity = 'flagado' | 'ambiguo'

export interface QCFinding {
  severidade: QCSeverity
  regra: string
  take?: string // "Take 2" quando localizável
  motivo: string
  sugestao?: string
}

export interface QCResult {
  status: 'aprovado' | 'ambiguo' | 'flagado'
  takes: number
  findings: QCFinding[]
}

// ---- Biblioteca ----
export type TermCategory =
  | 'camera' | 'motion' | 'estilo-visual' | 'estilo-video'
  | 'graficos' | 'web' | 'produto' | 'roupas' | 'sugeridos'

export interface TermPrompt {
  rotulo: string
  texto: string
}

export interface Term {
  id: string
  categoria: TermCategory
  termo: string
  sinonimos: string[]
  explicacao: string
  prompts: TermPrompt[]
  demo?: string
  referencia_real?: string // URL que o usuário anexa
  custom?: boolean // termo adicionado pelo usuário
}

// Biblioteca de Formatos que deram certo — prova concreta do que performou,
// captura MANUAL (não há acesso automático a métricas das redes).
export interface FormatEntry {
  id: string
  clienteProjeto: string
  tipo: string        // comercial, talking-head, motion, still de produto, ...
  descricao: string   // o que foi feito, texto livre
  data: string        // ISO
  metrica?: string    // views/likes ou texto livre ("melhor CTR do mês")
  link?: string
  tags: string[]
  createdAt: string
}

// ---- Portal de Aprovação e Processo (entregas) ----
export type DeliveryItemStatus = 'pendente' | 'aprovado' | 'reprovado'

export interface DeliveryItem {
  id: string
  tipo: 'imagem' | 'video'
  file: string          // basename do arquivo 4K salvo no volume
  mimeType: string
  originalName?: string
  thumbnail?: string    // dataUrl pequeno (gerado no upload) pra galeria leve
  status: DeliveryItemStatus
  comentario?: string
  updatedAt: string
}

export interface DeliveryDirection {
  rotulo?: string       // "Padrão" | "Repertório" | "Aberto" | livre
  conceito: string
  tom?: string
  escolhida?: boolean
}

// Recado em áudio do cliente no portal — chega transcrito pro operador.
export interface AudioFeedback {
  id: string
  file: string          // basename do áudio salvo no volume (junto dos itens)
  mimeType: string
  transcript: string
  createdAt: string
}

export interface DeliveryProcess {
  origem: string        // briefing/ideia original
  direcoes: DeliveryDirection[] // consideradas (incluindo descartadas)
  direcaoEscolhida: string
  motivoEscolha: string
  qcValidado: boolean
  canvas?: string       // cena Excalidraw (JSON) — canvas livre do processo
}

export interface Delivery {
  id: string
  clientId?: string
  clienteNome: string
  titulo: string
  slug: string          // público, editável, nome + sufixo aleatório
  createdAt: string
  processo: DeliveryProcess
  itens: DeliveryItem[]
  audios?: AudioFeedback[]   // recados em áudio do cliente (transcritos)
  // Ciclo de vida / auto-limpeza do volume:
  receivedAt?: string   // cliente confirmou recebimento — trava o cliente e inicia a janela de 24h
  keep?: boolean        // operador clicou "Manter" — cancela a auto-remoção
}

export interface DeliveryIndexEntry {
  id: string
  slug: string
  clienteNome: string
  titulo: string
  createdAt: string
  receivedAt?: string   // espelhado do Delivery p/ o sweep ler só o índice
  keep?: boolean
}

// Histórico de uso: registrado quando o usuário copia um prompt de um termo.
export interface LibraryHistoryItem {
  termId: string
  termo: string
  categoria: TermCategory
  rotulo: string // rótulo do prompt copiado (ex: "Cinematográfico")
  texto: string  // prompt copiado
  timestamp: string
}
