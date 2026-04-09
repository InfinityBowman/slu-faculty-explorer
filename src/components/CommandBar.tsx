import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { MessageSquare, RotateCcw, Send, Square, X } from 'lucide-react'
import { useChat } from '@/lib/ai/use-chat'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { executeDataTool } from '@/lib/ai/data-executor'
import { executeToolCall } from '@/lib/ai/action-executor'
import { DATA_TOOL_NAMES } from '@/lib/ai/tools'
import { useAppStore } from '@/store/appStore'
import type { Faculty } from '@/lib/types'
import type { ToolCall } from '@/lib/ai/use-chat'
import { cn } from '@/lib/utils'

const SUGGESTIONS = [
  'Who has the highest h-index?',
  'Show me the top 5 faculty by m-index',
  'Tell me about Chaifetz School of Business',
  'Search for faculty studying machine learning',
  'Plot h-index vs citations colored by school',
]

const TOOL_LABELS: Record<string, string> = {
  get_dataset_summary: 'Getting dataset stats',
  get_faculty_detail: 'Looking up faculty',
  get_school_summary: 'Fetching school data',
  get_department_summary: 'Fetching department data',
  get_rankings: 'Building rankings',
  search_faculty: 'Searching faculty',
  set_filters: 'Updating filters',
  set_scatter: 'Configuring chart',
  clear_filters: 'Resetting filters',
}

interface CommandBarProps {
  faculty: Array<Faculty> | null
}

export function CommandBar({ faculty }: CommandBarProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    isStreaming,
    sendMessage,
    toolCalls,
    pendingTools,
    cancel,
    reset,
  } = useChat()

  // Read filter state for system prompt
  const search = useAppStore((s) => s.search)
  const school = useAppStore((s) => s.school)
  const department = useAppStore((s) => s.department)
  const tier = useAppStore((s) => s.tier)
  const metricSource = useAppStore((s) => s.metricSource)

  // Cmd+K toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingTools])

  // Execute UI tool calls when they arrive
  useEffect(() => {
    for (const tc of toolCalls) {
      if (!DATA_TOOL_NAMES.has(tc.name)) {
        executeToolCall(tc)
      }
    }
  }, [toolCalls])

  const resolveDataTools = useCallback(
    async (tools: Array<ToolCall>) => {
      if (!faculty) return []
      const results = await Promise.all(
        tools.map((tc) => executeDataTool(tc, faculty)),
      )
      return results
    },
    [faculty],
  )

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return
      setInput('')
      const context = buildSystemPrompt(
        { search, school, department, tier, metricSource },
        faculty,
      )
      await sendMessage(text.trim(), context, resolveDataTools)
    },
    [
      isStreaming,
      search,
      school,
      department,
      tier,
      metricSource,
      faculty,
      sendMessage,
      resolveDataTools,
    ],
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium shadow-lg transition-colors"
      >
        <MessageSquare className="size-4" />
        Ask about faculty
        <kbd className="bg-primary-foreground/20 ml-1 rounded px-1.5 py-0.5 text-[10px]">
          {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
      <div className="bg-card/95 flex flex-col overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-[13px] font-medium">Faculty Explorer AI</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
              title="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="max-h-[50vh] min-h-[200px] overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-[12px]">
                Ask questions about SLU faculty research data. I can look up
                stats, search for people, and configure the explorer.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSubmit(s)}
                    className="bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 text-[11px] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-[13px] leading-relaxed',
                    msg.role === 'user' && 'text-right',
                  )}
                >
                  {msg.role === 'user' ? (
                    <span className="bg-primary text-primary-foreground inline-block rounded-2xl rounded-br-sm px-3 py-2">
                      {msg.content}
                    </span>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}
                </div>
              ))}

              {/* Pending tool badges */}
              {pendingTools.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {pendingTools.map((name, i) => (
                    <span
                      key={i}
                      className="bg-primary/10 text-primary animate-pulse rounded-full px-2.5 py-1 text-[10px] font-medium"
                    >
                      {TOOL_LABELS[name] ?? name}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Streaming indicator */}
              {isStreaming && pendingTools.length === 0 ? (
                <div className="text-muted-foreground flex items-center gap-2 text-[12px]">
                  <span className="bg-primary inline-block size-1.5 animate-pulse rounded-full" />
                  Thinking...
                </div>
              ) : null}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t px-3 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit(input)
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about faculty data..."
              disabled={isStreaming}
              className="placeholder:text-muted-foreground flex-1 bg-transparent text-[13px] focus:outline-none disabled:opacity-50"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={cancel}
                className="text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
                title="Stop"
              >
                <Square className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="text-muted-foreground hover:text-primary rounded-md p-1.5 transition-colors disabled:opacity-30"
                title="Send"
              >
                <Send className="size-4" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
