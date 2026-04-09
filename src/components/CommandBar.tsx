import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MessageSquare, RotateCcw, Send, Square, X } from 'lucide-react'
import type { Faculty } from '@/lib/types'
import type { ToolCall } from '@/lib/ai/use-chat'
import { useChat } from '@/lib/ai/use-chat'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { executeDataTool } from '@/lib/ai/data-executor'
import { executeToolCall } from '@/lib/ai/action-executor'
import { DATA_TOOL_NAMES } from '@/lib/ai/tools'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

const PAGE_SUGGESTIONS: Record<
  string,
  { description: string; suggestions: Array<string> }
> = {
  '/': {
    description:
      'Ask questions about faculty data. I can look up stats, search for people, and configure the scatter chart.',
    suggestions: [
      'Who has the highest h-index?',
      'Top 5 faculty by m-index',
      'Tell me about Chaifetz Business',
      'Search for machine learning researchers',
      'Plot h-index vs citations colored by school',
    ],
  },
  '/schools': {
    description:
      'Ask about school-level comparisons, tier distributions, or specific schools.',
    suggestions: [
      'Which school has the most top-5% faculty?',
      'Tell me about the School of Social Work',
      'How does Nursing compare to Education?',
      'What fields does Arts & Sciences cover?',
    ],
  },
  '/insights': {
    description:
      'Ask about the analytics shown on this page or dig into the underlying data.',
    suggestions: [
      'Summarize the tier distribution',
      'Which schools have the highest FWCI?',
      'How does m-index vary by career stage?',
      'Do administrators publish less?',
    ],
  },
  '/about': {
    description:
      'Ask about methodology, data sources, or how metrics are computed.',
    suggestions: [
      'How is field tier calculated?',
      'Why is Scholar coverage so low?',
      'What does m-index measure?',
      'How many faculty have no data?',
    ],
  },
}

const DEFAULT_PAGE_INFO = {
  description: 'Ask questions about SLU faculty research data.',
  suggestions: [
    'Who has the highest h-index?',
    'Tell me about Chaifetz Business',
  ],
}

const TOOL_LABELS: Record<string, string> = {
  get_dataset_summary: 'Getting dataset stats',
  get_faculty_detail: 'Looking up faculty',
  get_school_summary: 'Fetching school data',
  get_department_summary: 'Fetching department data',
  get_rankings: 'Building rankings',
  search_faculty: 'Searching faculty',
  run_analysis: 'Running analysis',
  set_filters: 'Updating filters',
  set_scatter: 'Configuring chart',
  clear_filters: 'Resetting filters',
}

interface CommandBarProps {
  faculty: Array<Faculty> | null
  currentPage: string
}

export function CommandBar({ faculty, currentPage }: CommandBarProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
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
      if (inputRef.current) inputRef.current.style.height = 'auto'
      const context = buildSystemPrompt(
        { search, school, department, tier, metricSource },
        faculty,
        currentPage,
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
      currentPage,
      sendMessage,
      resolveDataTools,
    ],
  )

  return (
    <>
      {/* Floating trigger button — visible when panel is closed */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90',
          open
            ? 'pointer-events-none translate-y-2 opacity-0'
            : 'translate-y-0 opacity-100',
        )}
      >
        <MessageSquare className="size-4" />
        Ask about faculty
        <kbd className="ml-1 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">
          {typeof navigator !== 'undefined' &&
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- navigator.platform is undefined in Cloudflare Workers SSR
          navigator.platform?.includes('Mac')
            ? '\u2318'
            : 'Ctrl'}
          K
        </kbd>
      </button>

      {/* Chat panel — always mounted, hidden via CSS + inert when closed */}
      <div
        inert={!open || undefined}
        className={cn(
          'fixed bottom-6 left-1/2 z-50 w-full max-w-120 -translate-x-1/2 transition-all duration-200 ease-out',
          open
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0',
        )}
      >
        <div className="flex flex-col overflow-hidden rounded-xl border bg-card/95 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-[13px] font-medium">Faculty Explorer AI</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                title="Reset conversation"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                title="Close"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="max-h-[50vh] min-h-50 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[12px] text-muted-foreground">
                  {
                    (PAGE_SUGGESTIONS[currentPage] ?? DEFAULT_PAGE_INFO)
                      .description
                  }
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(
                    PAGE_SUGGESTIONS[currentPage] ?? DEFAULT_PAGE_INFO
                  ).suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSubmit(s)}
                      className="rounded-full bg-muted px-3 py-1.5 text-[11px] transition-colors hover:bg-muted/80"
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
                      <span className="inline-block rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                        {msg.content}
                      </span>
                    ) : (
                      <div className="prose prose-sm max-w-none text-[13px] dark:prose-invert [&_table]:block [&_table]:overflow-x-auto [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </Markdown>
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
                        className="animate-pulse rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary"
                      >
                        {TOOL_LABELS[name] ?? name}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Streaming indicator */}
                {isStreaming && pendingTools.length === 0 ? (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
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
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  // Auto-resize: reset height then set to scrollHeight
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                onKeyDown={(e) => {
                  // Enter submits, Shift+Enter inserts newline
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(input)
                  }
                }}
                placeholder="Ask about faculty data..."
                disabled={isStreaming}
                rows={1}
                className="min-w-0 flex-1 resize-none bg-transparent text-[13px] leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                style={{ maxHeight: 120 }}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={cancel}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  title="Stop"
                >
                  <Square className="size-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-primary disabled:opacity-30"
                  title="Send"
                >
                  <Send className="size-4" />
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
