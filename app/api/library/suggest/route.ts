import Anthropic from '@anthropic-ai/sdk'
import { listTerms } from '@/lib/store'
import { logUsage } from '@/lib/costlog'
import { HAIKU_MODEL } from '@/lib/ai'

// Gerador de termos candidatos — alimenta a biblioteca de forma sustentável.
// O Haiku propõe termos que AINDA NÃO existem no catálogo; o usuário aprova
// um a um (nada entra sozinho).

export const maxDuration = 60

const SCHEMA = {
  type: 'object',
  properties: {
    candidatos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          categoria: { type: 'string', enum: ['camera', 'motion', 'estilo-visual', 'estilo-video', 'graficos', 'web', 'produto', 'roupas'] },
          termo: { type: 'string' },
          sinonimos: { type: 'array', items: { type: 'string' } },
          explicacao: { type: 'string' },
          prompts: {
            type: 'array',
            items: {
              type: 'object',
              properties: { rotulo: { type: 'string' }, texto: { type: 'string' } },
              required: ['rotulo', 'texto'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'categoria', 'termo', 'sinonimos', 'explicacao', 'prompts'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidatos'],
  additionalProperties: false,
}

const CLAUDE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: Request) {
  const { categoria, tema, image } = (await request.json()) as {
    categoria?: string
    tema?: string
    image?: { dataUrl: string; mimeType: string }
  }
  const hasImage = !!(image?.dataUrl && CLAUDE_IMAGE_TYPES.includes(image.mimeType) && image.dataUrl.includes(','))

  const existing = listTerms().map(t => `${t.id} (${t.termo})`).join(', ')

  const system = `Você alimenta uma biblioteca de vocabulário audiovisual de um produtor de vídeo com IA brasileiro. Proponha 5 termos técnicos NOVOS que ainda não estão no catálogo.

Regras de conteúdo:
- sinonimos: 3-5 formas LEIGAS como um brasileiro descreveria o efeito sem saber o nome.
- explicacao: PT-BR, 2-4 frases, simples como pra criança, dizendo QUANDO usar.
- prompts: 2 variações em inglês (rotulo "Direto" curto/técnico e "Cinematográfico" denso). Nunca "4K/8K/photorealistic/unreal engine". Pessoas sempre como REAIS fotografadas — nunca "AI-generated/avatar/CGI/digital human".
- id: slug kebab-case.

Quando vier uma IMAGEM de referência, leia o visual dela (efeito, movimento, luz, textura, enquadramento, estilo) e proponha termos que REPRODUZAM o que a imagem mostra — é isso que o usuário quer nomear e reutilizar.

TERMOS JÁ EXISTENTES (não repita nenhum): ${existing}`

  const textInstru = tema?.trim()
    ? `Proponha termos sobre: ${tema}${categoria ? ` (categoria ${categoria})` : ''}`
    : hasImage
      ? `Proponha termos que capturem o estilo/efeito da imagem de referência anexada${categoria ? ` (categoria ${categoria})` : ''}.`
      : `Proponha termos úteis da categoria: ${categoria || 'qualquer uma com lacuna no catálogo'}`

  const userContent: Anthropic.ContentBlockParam[] = []
  if (hasImage) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image!.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: image!.dataUrl.split(',')[1],
      },
    })
  }
  userContent.push({ type: 'text', text: textInstru })

  const client = new Anthropic()
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2500,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: userContent }],
  })

  logUsage('library-suggest', HAIKU_MODEL, response.usage.input_tokens, response.usage.output_tokens)

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
  try {
    return Response.json(JSON.parse(text))
  } catch {
    return Response.json({ candidatos: [] })
  }
}
