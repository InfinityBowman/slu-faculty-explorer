import { createFileRoute } from '@tanstack/react-router'
import { TOOL_DEFINITIONS } from '@/lib/ai/tools'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.OPENROUTER_API_KEY
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }

        let body: {
          messages: Array<{
            role: string
            content?: string
            tool_calls?: Array<{
              id: string
              type: 'function'
              function: { name: string; arguments: string }
            }>
            tool_call_id?: string
          }>
          context: string
        }
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { messages, context } = body

        if (!Array.isArray(messages) || messages.length > 100) {
          return new Response(
            JSON.stringify({ error: 'Invalid messages' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (typeof context !== 'string' || context.length > 50000) {
          return new Response(
            JSON.stringify({ error: 'Invalid context' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const sanitizedMessages = messages.map((m) => {
          if (m.role === 'tool' && m.tool_call_id) {
            return {
              role: 'tool' as const,
              tool_call_id: m.tool_call_id,
              content:
                typeof m.content === 'string' ? m.content.slice(0, 8000) : '',
            }
          }
          if (
            m.role === 'assistant' &&
            m.tool_calls &&
            Array.isArray(m.tool_calls)
          ) {
            return {
              role: 'assistant' as const,
              content: typeof m.content === 'string' ? m.content : null,
              tool_calls: m.tool_calls.slice(0, 20).map((tc) => ({
                id: String(tc.id).slice(0, 64),
                type: 'function' as const,
                function: {
                  name: String(tc.function.name).slice(0, 64),
                  arguments: String(tc.function.arguments).slice(0, 8000),
                },
              })),
            }
          }
          return {
            role:
              m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content:
              typeof m.content === 'string' ? m.content.slice(0, 8000) : '',
          }
        })

        const openRouterBody = {
          model: 'minimax/minimax-m2.7',
          stream: true,
          messages: [
            { role: 'system', content: context },
            ...sanitizedMessages,
          ],
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
        }

        const upstreamRes = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://slu-faculty-explorer.pages.dev',
              'X-Title': 'SLU Faculty Research Explorer',
            },
            body: JSON.stringify(openRouterBody),
          },
        )

        if (!upstreamRes.ok) {
          const errText = await upstreamRes.text()
          let detail = errText
          try {
            const parsed = JSON.parse(errText)
            detail = parsed.error?.message ?? errText
          } catch {}
          const friendlyMessages: Record<number, string> = {
            401: 'Invalid OpenRouter API key. Check OPENROUTER_API_KEY in .env',
            402: 'Insufficient OpenRouter credits. Add credits at https://openrouter.ai/credits',
            429: 'Rate limited by OpenRouter. Try again shortly',
          }
          return new Response(
            JSON.stringify({
              error:
                friendlyMessages[upstreamRes.status] ??
                `OpenRouter error: ${upstreamRes.status}`,
              detail,
            }),
            { status: 502, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const stream = new ReadableStream({
          async start(controller) {
            const reader = upstreamRes.body?.getReader()
            if (!reader) {
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ error: 'No response body' })}\n\n`,
                ),
              )
              controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
              controller.close()
              return
            }

            let buffer = ''

            try {
              for (;;) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const line of lines) {
                  const trimmed = line.trim()
                  if (!trimmed || !trimmed.startsWith('data: ')) continue
                  const data = trimmed.slice(6)
                  if (data === '[DONE]') continue

                  try {
                    const chunk = JSON.parse(data)
                    const delta = chunk.choices?.[0]?.delta
                    if (!delta) continue

                    if (delta.tool_calls) {
                      for (const tc of delta.tool_calls) {
                        if (tc.function?.name) {
                          controller.enqueue(
                            encoder.encode(
                              `event: tool_call_start\ndata: ${JSON.stringify({
                                index: tc.index,
                                id: tc.id,
                                name: tc.function.name,
                                arguments: tc.function.arguments ?? '',
                              })}\n\n`,
                            ),
                          )
                        } else if (tc.function?.arguments) {
                          controller.enqueue(
                            encoder.encode(
                              `event: tool_call_chunk\ndata: ${JSON.stringify({
                                index: tc.index,
                                arguments: tc.function.arguments,
                              })}\n\n`,
                            ),
                          )
                        }
                      }
                    }

                    if (delta.content) {
                      controller.enqueue(
                        encoder.encode(
                          `event: text\ndata: ${JSON.stringify({ content: delta.content })}\n\n`,
                        ),
                      )
                    }
                  } catch {
                    // Skip malformed JSON lines
                  }
                }
              }
            } catch (err) {
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`,
                ),
              )
            }

            controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
            controller.close()
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
