import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface TocItem {
  id: string
  label: string
}

interface TocSidebarProps {
  items: ReadonlyArray<TocItem>
}

export function TocSidebar({ items }: TocSidebarProps) {
  const activeId = useScrollSpy(items.map((t) => t.id))

  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-8">
        <div className="mb-3 text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          On this page
        </div>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={cn(
                  'block border-l-2 py-1 pl-3 text-[12px] transition-colors',
                  activeId === item.id
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

// Tracks which section is currently active in the viewport by maintaining a
// persistent set of visible section IDs. IntersectionObserver callbacks only
// include entries whose state *changed*, so we accumulate into a Set and pick
// the topmost visible section on every callback.
function useScrollSpy(ids: ReadonlyArray<string>): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)
  const visibleRef = useRef(new Set<string>())

  useEffect(() => {
    visibleRef.current.clear()

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleRef.current.add(entry.target.id)
          } else {
            visibleRef.current.delete(entry.target.id)
          }
        }

        // Pick the first section (in document order) that is currently visible
        const first = ids.find((id) => visibleRef.current.has(id))
        if (first) {
          setActiveId(first)
        }
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0 },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return activeId
}
