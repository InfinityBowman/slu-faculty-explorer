import { createFileRoute } from '@tanstack/react-router'
import {
  chat,
  convertMessagesToModelMessages,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { createOpenRouterText } from '@tanstack/ai-openrouter'
import { TOOL_DEFS } from '@/lib/ai/tools'

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
          messages: Array<any>
          data?: { context?: string; model?: string }
        }
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { messages, data } = body

        if (!Array.isArray(messages) || messages.length > 100) {
          return new Response(
            JSON.stringify({ error: 'Invalid messages' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const systemPrompt = data?.context ?? ''
        const modelId =
          data?.model === 'smart'
            ? 'deepseek/deepseek-v3.2'
            : 'openai/gpt-5.4-mini'
        const adapter = createOpenRouterText(modelId as any, apiKey)

        const stream = chat({
          adapter,
          messages: convertMessagesToModelMessages(messages) as any,
          systemPrompts: [systemPrompt],
          tools: TOOL_DEFS,
        })

        return toServerSentEventsResponse(stream)
      },
    },
  },
})
