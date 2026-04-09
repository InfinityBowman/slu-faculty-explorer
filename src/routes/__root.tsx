import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from '@tanstack/react-router'
import appCss from '../index.css?url'
import { CommandBar } from '@/components/CommandBar'
import { ThemeProvider } from '@/components/theme-provider'
import { useFacultyData } from '@/hooks/useFaculty'
import { cn } from '@/lib/utils'

// Runs inline in <head> before React hydrates so the correct theme class is
// applied to <html> — prevents a flash of the wrong theme.
const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');var t=s==='dark'||s==='light'||s==='system'?s:'light';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.classList.add(r);}catch(e){document.documentElement.classList.add('light');}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'SLU Faculty Research Explorer' },
      {
        name: 'description',
        content:
          "Explore research productivity and impact metrics for Saint Louis University's 519 active PhD faculty using Google Scholar and OpenAlex data. Interactive scatter plots, school comparisons, and AI-powered data exploration.",
      },
      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'SLU Faculty Research Explorer' },
      {
        property: 'og:description',
        content:
          'Interactive bibliometric dashboard for Saint Louis University. Explore h-index, citations, FWCI, and field-normalized rankings across 519 faculty.',
      },
      { property: 'og:url', content: 'https://faculty.jacobmaynard.dev' },
      {
        property: 'og:image',
        content: 'https://faculty.jacobmaynard.dev/og-image.png',
      },
      { property: 'og:site_name', content: 'SLU Faculty Research Explorer' },
      // Twitter / X
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'SLU Faculty Research Explorer' },
      {
        name: 'twitter:description',
        content:
          'Interactive bibliometric dashboard for Saint Louis University. Explore h-index, citations, FWCI, and field-normalized rankings across 519 faculty.',
      },
      {
        name: 'twitter:image',
        content: 'https://faculty.jacobmaynard.dev/og-image.png',
      },
      // Additional SEO
      { name: 'robots', content: 'index, follow' },
      { name: 'author', content: 'Jacob Maynard' },
      {
        name: 'keywords',
        content:
          'Saint Louis University, SLU, faculty research, bibliometrics, h-index, Google Scholar, OpenAlex, FWCI, citation analysis, research productivity',
      },
      { name: 'theme-color', content: '#003DA5' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/icon-lens.svg' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'canonical', href: 'https://faculty.jacobmaynard.dev' },
      { rel: 'stylesheet', href: appCss },
    ],
    scripts: [{ children: themeInitScript }],
  }),

  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { data } = useFacultyData()
  const { pathname } = useLocation()

  return (
    <div className="min-h-svh">
      <Header />
      <Outlet />
      <Footer />
      <CommandBar faculty={data} currentPage={pathname} />
    </div>
  )
}

function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-5">
        <div className="h-8 w-[3px] rounded-sm bg-primary" aria-hidden />
        <div className="flex-1">
          <h1 className="text-[19px] leading-tight font-semibold tracking-tight">
            SLU Faculty Research Explorer
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Google Scholar &amp; OpenAlex metrics
          </p>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/">Explorer</NavLink>
          <NavLink to="/schools">Schools</NavLink>
          <NavLink to="/insights">Insights</NavLink>
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
  to: '/' | '/schools' | '/insights' | '/about'
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{
        className: cn(
          'rounded-md bg-muted px-3 py-1.5 text-[12px] font-medium text-foreground',
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
    <footer className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-8 text-xs text-muted-foreground">
      <span>
        Sources: Google Scholar &amp; OpenAlex ·{' '}
        <span className="tabular">Saint Louis University</span>
      </span>
      <a
        href="https://github.com/InfinityBowman/slu-faculty-explorer"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-foreground"
      >
        View on GitHub
      </a>
    </footer>
  )
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-200px)] max-w-[1400px] flex-col items-center justify-center px-6 py-16">
      <div className="flex items-center gap-6">
        <div className="h-24 w-[3px] rounded-sm bg-primary" aria-hidden />
        <div>
          <p className="tabular text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Error 404
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist. It may have
            been moved, or the link may be incorrect.
          </p>
          <div className="mt-6 flex items-center gap-1">
            <Link
              to="/"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to Explorer
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center rounded-md px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              About this data
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
