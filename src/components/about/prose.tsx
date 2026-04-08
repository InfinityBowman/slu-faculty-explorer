import { cn } from '@/lib/utils'

// Prose primitives shared across all About-page sections. Kept restrained
// (matching the explorer's typography) so the explainer reads like part of
// the same product, not a marketing site.

export function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-foreground mb-4 text-[20px] font-semibold tracking-tight">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-foreground mt-6 mb-2 text-[14px] font-semibold tracking-tight">
      {children}
    </h3>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-foreground/85 text-[14px] leading-relaxed">{children}</p>
  )
}

export function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="text-foreground/85 marker:text-muted-foreground/60 list-disc space-y-1 pl-5 text-[14px] leading-relaxed">
      {children}
    </ul>
  )
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-foreground font-semibold">{children}</strong>
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[12px]">
      {children}
    </code>
  )
}

export function Anchor({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a href={href} className="text-primary underline-offset-2 hover:underline">
      {children}
    </a>
  )
}

export function Callout({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-4 py-3 text-[13px] leading-relaxed',
        tone === 'warn'
          ? 'border-amber-300/40 bg-amber-50/60 text-amber-950'
          : 'border-primary/20 bg-primary/5 text-foreground/90',
      )}
    >
      {children}
    </div>
  )
}
