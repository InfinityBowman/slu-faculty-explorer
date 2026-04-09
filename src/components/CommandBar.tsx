import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchServerSentEvents, useChat } from '@tanstack/ai-react'
import { Brain, MessageSquare, RotateCcw, Send, Square, X, Zap } from 'lucide-react'
import type { Faculty } from '@/lib/types'
import { CLIENT_TOOLS, setFacultyData } from '@/lib/ai/tools'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
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
  const [model, setModel] = useState<'fast' | 'smart'>('fast')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sync faculty data for client tools
  useEffect(() => {
    if (faculty) setFacultyData(faculty)
  }, [faculty])

  // Read filter state for system prompt
  const search = useAppStore((s) => s.search)
  const school = useAppStore((s) => s.school)
  const department = useAppStore((s) => s.department)
  const tier = useAppStore((s) => s.tier)
  const metricSource = useAppStore((s) => s.metricSource)

  const systemPrompt = useMemo(
    () =>
      buildSystemPrompt(
        { search, school, department, tier, metricSource },
        faculty,
        currentPage,
      ),
    [search, school, department, tier, metricSource, faculty, currentPage],
  )

  const connection = useMemo(() => fetchServerSentEvents('/api/chat'), [])
  const body = useMemo(
    () => ({ context: systemPrompt, model }),
    [systemPrompt, model],
  )

  const { messages, sendMessage, stop, isLoading, clear } = useChat({
    connection,
    tools: CLIENT_TOOLS,
    body,
  })

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
  }, [messages])

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return
      setInput('')
      if (inputRef.current) inputRef.current.style.height = 'auto'
      await sendMessage(text.trim())
    },
    [isLoading, sendMessage],
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
                onClick={() =>
                  setModel((m) => (m === 'fast' ? 'smart' : 'fast'))
                }
                className={cn(
                  'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  model === 'smart'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title={
                  model === 'fast'
                    ? 'Using fast model (GPT 5.4 Mini). Click for smart.'
                    : 'Using smart model (DeepSeek V3.2). Click for fast.'
                }
              >
                {model === 'fast' ? (
                  <Zap className="size-3" />
                ) : (
                  <Brain className="size-3" />
                )}
                {model === 'fast' ? 'Fast' : 'Smart'}
              </button>
              <button
                type="button"
                onClick={clear}
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
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'text-[13px] leading-relaxed',
                      msg.role === 'user' && 'text-right',
                    )}
                  >
                    {msg.role === 'user' ? (
                      <span className="inline-block rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                        {msg.parts
                          .filter(
                            (p): p is { type: 'text'; content: string } =>
                              p.type === 'text',
                          )
                          .map((p) => p.content)
                          .join('')}
                      </span>
                    ) : (
                      <div className="space-y-2">
                        {msg.parts.map((part, j) => {
                          if (part.type === 'text') {
                            return (
                              <div
                                key={j}
                                className="prose prose-sm max-w-none text-[13px] dark:prose-invert [&_table]:block [&_table]:overflow-x-auto [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                              >
                                <Markdown remarkPlugins={[remarkGfm]}>
                                  {part.content}
                                </Markdown>
                              </div>
                            )
                          }
                          if (part.type === 'tool-call') {
                            const label =
                              TOOL_LABELS[part.name]
                            const isDone =
                              part.state === 'input-complete' &&
                              part.output !== undefined
                            return (
                              <span
                                key={j}
                                className={cn(
                                  'inline-block rounded-full px-2.5 py-1 text-[10px] font-medium',
                                  isDone
                                    ? 'bg-muted text-muted-foreground'
                                    : 'animate-pulse bg-primary/10 text-primary',
                                )}
                              >
                                {label}
                              </span>
                            )
                          }
                          return null
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming indicator */}
                {isLoading &&
                !messages
                  .at(-1)
                  ?.parts.some(
                    (p) =>
                      p.type === 'tool-call' && p.output === undefined,
                  ) ? (
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
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(input)
                  }
                }}
                placeholder="Ask about faculty data..."
                disabled={isLoading}
                rows={1}
                className="min-w-0 flex-1 resize-none bg-transparent text-[13px] leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                style={{ maxHeight: 120 }}
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={stop}
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
