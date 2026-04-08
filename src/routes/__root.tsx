import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-svh">
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-5">
        <div className="bg-primary h-8 w-[3px] rounded-sm" aria-hidden />
        <div className="flex-1">
          <h1 className="text-[19px] leading-tight font-semibold tracking-tight">
            SLU Faculty Research Explorer
          </h1>
          <p className="text-muted-foreground mt-0.5 text-[12px]">
            Google Scholar &amp; OpenAlex metrics
          </p>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/">Explorer</NavLink>
          <NavLink to="/about">About this data</NavLink>
        </nav>
      </div>
    </header>
  )
}

function NavLink({
  to,
  children,
}: {
  to: '/' | '/about'
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
      activeProps={{
        className: cn(
          'text-foreground bg-muted rounded-md px-3 py-1.5 text-[12px] font-medium',
        ),
      }}
      activeOptions={{ exact: true }}
    >
      {children}
    </Link>
  )
}

function Footer() {
  return (
    <footer className="text-muted-foreground mx-auto max-w-[1400px] px-6 py-8 text-xs">
      Sources: Google Scholar &amp; OpenAlex ·{' '}
      <span className="tabular">Saint Louis University</span>
    </footer>
  )
}
