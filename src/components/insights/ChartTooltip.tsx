import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

const GAP = 12

export function useChartTooltip<T>() {
  const [data, setData] = useState<T | null>(null)
  const [rendered, setRendered] = useState<T | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Keep content visible during fade-out, clear after transition ends
  useEffect(() => {
    if (data != null) {
      setRendered(data)
    } else {
      const id = setTimeout(() => setRendered(null), 150)
      return () => clearTimeout(id)
    }
  }, [data])

  // Track cursor at document level while tooltip is visible or fading
  const active = data != null || rendered != null
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      const el = tooltipRef.current
      if (!el) return
      const { clientX: cx, clientY: cy } = e
      const { width, height } = el.getBoundingClientRect()
      const left =
        cx + GAP + width > window.innerWidth ? cx - width - GAP : cx + GAP
      const top =
        cy + GAP + height > window.innerHeight ? cy - height - GAP : cy + GAP
      el.style.left = `${left}px`
      el.style.top = `${top}px`
    }
    document.addEventListener('mousemove', handler, { passive: true })
    return () => document.removeEventListener('mousemove', handler)
  }, [active])

  return { data, rendered, setData, tooltipRef }
}

export function ChartTooltip({
  visible,
  tooltipRef,
  children,
}: {
  visible: boolean
  tooltipRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed z-50 rounded-md border bg-popover px-3 py-2 text-xs shadow-md transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {children}
    </div>
  )
}
