import { useEffect, useState } from 'react'
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
        <div className="text-muted-foreground mb-3 text-[10px] font-medium tracking-[0.08em] uppercase">
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
                    ? 'border-primary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent',
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

// Tracks which section heading is currently active in the viewport. The
// rootMargin shrinks the "active" band so a section becomes active when its
// heading crosses ~25% from the top — feels right at typical reading speeds.
function useScrollSpy(ids: ReadonlyArray<string>): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null)

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting entry on each tick.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return activeId
}
