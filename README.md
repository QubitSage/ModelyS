# ModelyS — arquivo do sistema

Snapshot do sistema Modely antes de reformular o **Dashboard** e a **Entrega** do zero.
Organizado em 3 pastas por área. O **Site** continua no ar (Fly, `modely.com.br`) e é o
único que precisa continuar deployável.

## Estrutura

| Pasta | O que é | Situação |
|---|---|---|
| **Site/** | O reel de marketing (`modely.com.br`) + a config compartilhada do projeto (package.json, next.config, tsconfig, Dockerfile, fly.toml, layout, globals, middleware) + libs base (`types.ts`, `store.ts`, `reel-store.ts`). | **Fica.** É o projeto vivo. |
| **Dashboard/** | O sistema criativo com IA: chat, Direção Criativa, Arena/Comitê, Biblioteca, Formatos, Ferramentas, QC, Esteira, CRM, Custos + toda a engine (`lib/ai`, `lib/creative`, `lib/qc`, `prompts/`, `scripts/`) e as rotas de API. | Arquivo. **Vai ser refeito do zero.** |
| **Entrega/** | O portal de entrega: `/e/[slug]` público, painel interno de entregas, rotas de API de deliveries/public, `PortalView`, `EntregasView`, canvas. | Arquivo. **Vai ser refeito do zero.** |

## Notas importantes

- **Segredos e dados fora do repo:** `.env*` (chaves de API) e `data/` (clientes, entregas, biblioteca)
  estão no `.gitignore` e **não** foram commitados. A biblioteca de estilos foi salva à parte.
- **Config compartilhada mora no Site:** como o projeto original era um monorepo Next.js único,
  Dashboard e Entrega referenciam libs/config que ficaram em `Site/`. É um arquivo de referência,
  não 3 apps independentes.
- **O site roda no Fly** (app `modely-vimio`). Mexer neste repo não desliga o site.
- Metodologia, cérebro de produção e regras de QC estão documentados à parte (pasta `modely-knowledge`).

## Stack
Next.js 16 · React 19 · Tailwind 4 · TypeScript · deploy Fly.io (volume persistente).
