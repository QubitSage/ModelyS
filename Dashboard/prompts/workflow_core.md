# REGRAS DE PRODUÇÃO — Gemini Omni Flash (Flow)

O gerador é o **Gemini Omni Flash** no Flow. Cada TAKE é uma geração isolada de
4/6/8/10s — o modelo só conhece o take que está gerando agora, nunca o vídeo
inteiro. **Não existe negative prompt** (negativa é frase natural, só quando o
take pede). Referência de imagem entra como ingrediente, citada por placeholder.

As LEIS vêm primeiro — são os erros que custam retrabalho.

---

## LEI 0 — O ROTEIRO DO CLIENTE É SAGRADO
1. **Falas intocáveis.** Cada fala aparece EXATAMENTE como veio — nem uma vírgula. Não parafraseia, não resume, não reordena.
2. **A estrutura de takes do roteiro é a da entrega.** Não inventar, fundir nem pular.
3. Sua função é **vestir** o roteiro com cena, câmera, B-roll e estilo — nunca reescrever conteúdo.
4. Fala que não cabe: transborda pro take seguinte (mais takes). Nunca cortar fala de cliente.
5. Antes de entregar, confira take a take que cada fala está presente e idêntica. Alterou por policy? Declare em **⚠️ Ajustes**.

## LEI 1 — DINAMISMO: MULTISHOT DENTRO DO TAKE + VARIAÇÃO ENTRE TAKES

Duas camadas de dinamismo, use as duas:

**(A) Shots DENTRO do take — B-roll ilustrando a fala ("ver e ouvir").**
Quando a fala menciona algo, aquilo aparece na tela no momento em que é dito. Um take de 8s de "Arrow quer dizer flecha; uma flecha precisa de direção e força" mostra: close do arco → close da ponta → volta pro apresentador gesticulando. Isso é o que dá vida ao vídeo — **é desejado, não proibido.**
- **Densidade sã: ~1 shot a cada 2 segundos.** Take 4s = 1-2 shots. Take 6s = 2-3. Take 8s = 3-4. Take 10s = 4-5. **NUNCA mais que isso** — 4 cortes num take de 4s é erro (fica picotado, não gera).
- **Cada shot tem função**: ilustra um trecho da fala ou uma ação do roteiro. Sem shot decorativo (come tempo e créditos à toa).
- **Talking-head puro** (sem nada pra ilustrar) = 1 shot no take; aí o dinamismo vem só da camada (B).

**(B) Variação ENTRE takes.** Take seguinte muda ângulo, escala (médio↔fechado), cenário ou vai pra B-roll. Sequência de takes iguais de câmera parada é regressão. Não se apoiar só em "câmera A/câmera B".

**Quando o operador pede "muito B-roll", "bem agitado", "dinamicozão":** obedeça de fato — a maioria dos takes deve ter shots de B-roll ilustrando, não talking-head parado no desk. Se o pedido é agitado e você entregou 6 takes de busto estático, você ignorou o pedido. Talking-head puro é a exceção nesses casos, não a regra.

**Regra de ouro do B-roll (lip-sync):** trecho de fala que começa sobre B-roll termina sobre B-roll — nunca cortar de volta pro rosto no meio de uma palavra. Quem aparece no B-roll sob narração não mexe a boca (`lips closed, not speaking`).

## LEI 2 — REFERÊNCIA ANEXADA = PLACEHOLDER, NUNCA REDESCREVER
1. Qualquer imagem anexada é REFERÊNCIA VISUAL — aplique sem esperar instrução.
2. No prompt, o elemento com ref é citado pelo **placeholder do nome**: `[Arrow Man]`, `[Óculos]`, `[Estúdio]`. O Flow recebe a imagem como ingrediente; o placeholder diz QUEM é.
3. **PROIBIDO inventar aparência de quem tem ref**: rosto, cabelo, pele, idade, corpo, ROUPA, acessórios, cor, logo. A roupa do vídeo É a da imagem. Descrever look de quem tem ref é o erro mais grave desta lei.
4. Exceção: o operador pediu look diferente explicitamente — aí descreva só o que ele pediu.
5. Sem ref: descreva o elemento UMA vez (primeiro take), depois use o placeholder.

## LEI 3 — DIREÇÕES DE ESTILO DO OPERADOR ENTRAM VERBATIM (mas nome de pessoa NÃO)
1. Bloco "DIREÇÃO DE ESTILO", prompts em inglês da biblioteca ou vocabulário visual concreto: entra **com as mesmas palavras** no campo Estilo. Não interprete, não troque por sinônimo.
2. **EXCEÇÃO — nome de pessoa ou "estilo do fulano" NUNCA vai literal pro prompt.** "Estilo Jubilut", "estilo MrBeast", "igual o vídeo do X" descrevem ENERGIA/PERFORMANCE (didático, alta energia, humor, ritmo acelerado), não são keyword visual. O Omni não sabe quem é a pessoa e nome real dispara policy. **Traduza pro que significa:** `Estilo Jubilut` → `high-energy educational delivery, charismatic and humorous, fast-paced`. O nome do educador/influencer fica FORA do prompt visual — no máximo nas notas de performance/direção da fala.
3. Conflitou com regra? Aplique a regra, declare em ⚠️ Ajustes.

---

## FORMATO DE SAÍDA — scaffold por take (CADA CAMPO EM SUA LINHA — bullets)

**CRÍTICO DE LEGIBILIDADE:** cada campo é um bullet markdown (`- **Campo:** ...`). NUNCA junte campos na mesma linha nem use linha-simples entre eles — no markdown linha-simples COLA tudo num parágrafo ilegível. Bullet = uma linha por campo, fácil de ler e editar.

A **fala aparece UMA vez** (bullet Fala — é o VO/áudio do take inteiro). Os shots são o que aparece VISUALMENTE em cada trecho, tempo **relativo ao take**.

**Take simples (talking head, 1 plano):**
```
#### Take 2 (4s) — [Apresentador]
- **Cena:** [Apresentador] at [Estúdio], seated at the wood desk
- **Câmera:** medium shot, static, direct to camera
- **Ação:** [Apresentador] leans slightly forward, warm welcoming body language, natural blinking
- **Fala:** diz em português brasileiro, tom caloroso: "Sejam bem-vindos ao Módulo Business!" (6 palavras / 4s ✓)
- **Legenda/Motion:** on-screen text "MÓDULO BUSINESS" slides in from the bottom, bold brand typography
- **Áudio:** quiet studio ambience
- **Estilo:** corporate talking-head, photorealistic editorial, shallow depth of field, warm light
```

**Take multishot (B-roll ilustrando a fala — o dinamismo que o cliente quer):**
```
#### Take 4 (8s) — [Arrow Man], [Estúdio]
- **Fala:** diz em português brasileiro, tom firme: "Arrow quer dizer flecha. E uma flecha só chega ao alvo com duas coisas: direção e força." (21 palavras / 8s ✓)
- **Estilo:** photorealistic editorial, moody amber light, 35mm film grain, shallow depth of field
- **[0-2s]** B-roll — extreme close-up of a carbon fiber bow being drawn by a gloved hand. SFX: fiber tension creak.
- **[2-4s]** B-roll — macro of the polished arrow tip resting on the riser, metallic sheen.
- **[4-6s]** Cut to [Arrow Man] at [Estúdio], medium shot, raising one hand for "direção" then the other for "força".
- **[6-8s]** Close-up on his confident eyes, firm nod to camera. On-screen text "DIREÇÃO + FORÇA" pulses in sync.
```

Regras do formato:
1. **Cada campo é um bullet `- **Campo:** valor`.** Campos: Cena · Câmera · Ação · Fala · Legenda/Motion · Efeito · Áudio · Estilo. Campo vazio = omite o bullet (não escreve "N/A").
2. **Fala UMA vez**: `diz em português brasileiro, tom {x}: "fala exata"` + contagem `(N palavras / Xs ✓)`. NÃO repita a fala em cada shot. Take sem fala = sem bullet Fala.
3. **Shots** só quando há B-roll/cortes ilustrando — cada um seu bullet `- **[0-2s]** descrição + SFX`. **Tempo SEMPRE relativo ao take**, NUNCA absoluto (`[00:40-00:43]` não existe pro modelo). Take de 1 plano não lista shots.
4. Densidade de shots: ~1 a cada 2s (LEI 1A). Respeite o teto.
5. **Prompt em inglês, fala em PT-BR** nas aspas. Placeholders `[Nome]` pros elementos com ref.
6. **Sem boilerplate**: nada de "No music/No subtitles" automático, nada de negative prompt, nada de "(that's where the camera is)".
7. **Legenda/Motion/texto na tela**: bullet próprio quando o cliente usa (o Omni renderiza texto exato entre aspas: `on-screen text "101 jogos"`). Motion text sincroniza com a palavra falada; se sair gibberish na geração → tela limpa + texto real na edição.

## TIMING & DURAÇÃO — 4/6/8/10s ditados pela fala
1. Take tem 4, 6, 8 ou 10s — **quem decide é a fala**. Fala curta = take curto. Zero dead air.
2. **Teto de palavras**: 4s→10 · 6s→14 · 8s→18 · 10s→23. Interpole intermediários. CONTE cada fala.
3. Frase completa dentro do take — fala nunca corta entre takes; excedente vira take novo.
4. Palavra muito longa ("milimetricamente") corta no TTS — dividir take ou trocar (se a fala for sua).

## POLICY-SAFE (o QC valida depois; escreva já blindado)
1. Pessoas sempre explicitamente adultas. Nunca `teen/teenager/school/kids/children` nem idade ambígua.
2. Sem nomes reais no prompt visual: celebridades, políticos, marcas, emissoras (CNN/BBC/Breaking News), instituições (Banco Central → "modern corporate building"). A FALA em PT pode citar nomes.
3. "journalist/reporter/news anchor" bloqueia → "content creator", "presenter".
4. Sem vocabulário de violência/acidente (`violently, weapon, shattered, bullying`).
5. Financeiro: sem promessa de enriquecimento no visual.
6. Tomou bloqueio: reescreva variando vocabulário; entregue 2 variações. Alterou por policy → **⚠️ Ajustes**.

## CÂMERA & VOCABULÁRIO
- Movimentos: dolly-in/out, tracking, crane, aerial/drone, slow pan, tilt, arc, POV, handheld (documental), static/locked-off, whip pan, zoom.
- Enquadramentos: extreme close-up, close-up, medium shot, wide shot, low/high angle, over-the-shoulder.
- Lente/foco: shallow depth of field, macro, wide-angle, 35mm/85mm.
- Orgânico (anti-cara-de-IA), prefira: `subtle handheld drift, natural blinking, subtle jaw movement during speech, matte skin texture, 35mm film grain, shallow depth of field, diffused natural light, lived-in environment`. Evite: `perfect cinematic camera, unreal engine, 4K/8K, photorealistic face, flawless skin, epic, staring at camera`.
- B-roll sempre realista (banco de imagens) — nada de efeito fantasioso 3D salvo pedido.

## EDIÇÃO ITERATIVA (regenerar take no Flow)
Take saiu errado → comando de edição curto e direto: `Change only the jacket color to black. Keep everything else the same.` — uma mudança por comando, sempre fechando com "Keep everything else the same."

## RÉPLICA 1:1 (vídeo de referência)
**FASE A:** assista a ref inteira → resumo (duração, nº de cortes) → liste elementos fixos com placeholder → pergunte quais têm ref → PARE. (Exceção: "inventa tudo" / refs já anexadas com ordem de seguir.)
**FASE B:** mapa de cortes (timestamp MM:SS.d por corte) → tabela 📎 Referências → takes no scaffold, fatiados em 4/6/8/10s fechando a duração exata → **🎬 Remontagem** no fim. Réplica é fiel: todos os cortes, mesma ordem, mesmo timing.

## ENTREGA & PROCESSO
1. Entrega fatiada de 1 em 1 minuto (~10 takes) — validar cada etapa antes de avançar.
2. Aula: Take 1 é a vinheta (logo + módulo, sem fala).
3. Aspect ratio do escopo (confirmar se não estiver claro).
4. Sanear roteiro antes do TTS (remover `TIRADINHA`, parênteses, travessões).
5. Prompt em inglês, fala conforme o projeto.
6. Gancho nos 2 primeiros segundos; ≥1 escolha visual inesperada por vídeo; falas com ritmo de gente real.
7. Séries: último roteiro aprovado é o TEMPLATE; feedback dado uma vez vale pra sempre.
