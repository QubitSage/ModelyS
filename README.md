# Modely

Estúdio de produção de vídeo com IA — reescrita limpa do studio-v2, focada em:
chat de produção, QC de pacote, biblioteca de vocabulário e CRM/custos.

## Rodar

```powershell
cd C:\Users\bruno\Desktop\modely
npm run dev        # http://localhost:3000
```

Chaves em `.env.local` (Gemini, Anthropic). Dados em `data/` (JSON por cliente).

## O que tem

| Módulo | Onde | O que faz |
|---|---|---|
| **Estúdio** | sidebar → cliente → conversa | Chat de produção com as regras do workflow core. Gemini 3.5 Flash (padrão/multimodal) ou Sonnet 5 (criativo), streaming, briefing/notas/refs por conversa. |
| **QC** | botão `✓ QC` em qualquer resposta com takes | Validação determinística antes do Flow: blocklist de política (global + por cliente), fala vs duração (tabela 4s→10 … 10s→23 palavras), cortes internos vs duração (4s→0 · 6s→1 · 8s→2 · 10s→3; com fala, um a menos), fala duplicada no take, placeholder vazado, cap de 6 shots, grade de takes (só com timestamps absolutos). Entende o formato scaffold (Cena:/Câmera:/Ação:/Fala:/…) e o formato antigo. Resultado no painel direito. |
| **Biblioteca** | sidebar → Biblioteca | 64 termos em 7 categorias, busca por sinônimo leigo, demos animadas (as de web reagem ao mouse), prompts com copiar, referência real por termo, cadastro de termo novo. **Assistente** (descreve solto → acha o termo) e **Analisador de briefing** (cola briefing → 4-6 direções de estilo), ambos via Haiku 4.5 com custo logado. |
| **CRM** | sidebar → CRM | Pipeline de deals por estágio (mover com ←/→), total contratado/recebido. |
| **Custos** | sidebar → Custos | Custo por cliente com margem sobre contrato, coluna de cache hits (⚡), orçamento mensal, e log das chamadas de fundo. |

## Política de roteamento de modelos

Regra geral: **determinístico → Haiku → Sonnet → Fable.** Sempre o mais barato
que dá conta; o que é caro deve ser raro.

| Função | Modelo | Onde está |
|---|---|---|
| Geração de prompts/roteiros | Gemini 3.5 Flash / Sonnet 5 (toggle) | `lib/ai.ts` — não descer de tier |
| Clonagem/análise de vídeo | Gemini 3.5 Flash | Ferramentas (`lib/tooljobs.ts`) |
| QC / validação de takes | Determinístico; ambíguos → Haiku | `lib/qc.ts` + `lib/qc-batch.ts` — nunca modelo caro em QC |
| Assistente da biblioteca | Haiku 4.5 | `/api/library/assistant` |
| Analisador de briefing | Haiku 4.5 | `/api/library/briefing` |
| Gerador de termos | Haiku 4.5 | `/api/library/suggest` |
| Consolidação de regras (pontual) | Modelo topo de linha, sob demanda | feito via sessão (resultado: `data/manual-de-producao.md`) |

Toda chamada loga `kind · modelo` em `data/costs-log.json` e aparece no painel
de Custos. **Pendência conhecida:** o painel mostra custo *estimado* (tokens ×
tabela); puxar o faturamento real exige Admin API key da Anthropic (endpoint
`/v1/organizations/usage_report`) e export de billing do Google Cloud — a
integrar quando as credenciais admin existirem.

## Manual de produção consolidado

`data/manual-de-producao.md` — regras extraídas das 1.129 mensagens migradas
(deduplicadas, com 5 conflitos sinalizados pra decisão humana na seção 9).
As blocklists por cliente (Professor: 16 termos, Manu: 21) foram populadas a
partir dele. Fontes intermediárias em `data/_rules-*.json`.

## Otimizações vs sistema antigo

- **Prompt caching de verdade**: system dividido em bloco estável (regras+memórias,
  com breakpoint de cache no Claude) e volátil (contexto da thread). Histórico
  cortado em **degraus de 16 mensagens** em vez de janela deslizante — o prefixo
  fica estável entre turnos e o caching (explícito no Claude, implícito no
  Gemini) volta a funcionar nas threads longas.
- **Regras condicionais**: o workflow core (41KB) só entra nos modos que geram
  prompt (produção/visual) — revisão não paga esse custo.
- **Custo observável**: toda chamada de fundo é logada (`data/costs-log.json`);
  mensagens de chat gravam `inputTokens/outputTokens/cacheReadTokens`.
- **QC determinístico**: as regras que o modelo "prometia" cumprir (contar
  palavras, somar takes, não vazar colchete) agora são verificadas por código.

## Estrutura

```
app/api/…            rotas (chat SSE, qc, clients/threads, library, costs)
components/…         App shell 3 colunas, ChatView, InfoPanel, LibraryView, TermDemo, CrmView, CostsView
lib/ai.ts            Gemini + Claude com caching e corte estável de histórico
lib/qc.ts            validador determinístico do pacote
lib/prompts.ts       montagem modular do system (estável + volátil)
lib/store.ts         persistência JSON (escrita atômica)
prompts/…            workflow_core.md + prompts por modo (copiados do studio-v2)
data/clients/…       Professor e Manu migrados (1.129 mensagens)
data/library/…       terms.json (64 termos) + custom + referências
scripts/migrate.mjs  migração do studio-v2
```

O sistema antigo (`Desktop\ModelyApp`) permanece intacto como arquivo morto —
os outros 16 clientes de CRM ficaram lá.
