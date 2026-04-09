import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import appCss from "../index.css?url"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

// Runs inline in <head> before React hydrates so the correct theme class is
// applied to <html> — prevents a flash of the wrong theme.
const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');var t=s==='dark'||s==='light'||s==='system'?s:'light';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.classList.add(r);}catch(e){document.documentElement.classList.add('light');}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "SLU Faculty Research Explorer" },
      {
        name: "description",
        content:
          "Explore research productivity and impact metrics for Saint Louis University faculty using Google Scholar and OpenAlex data.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/vite.svg" },
      { rel: "stylesheet", href: appCss },
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
  to: "/" | "/schools" | "/insights" | "/about"
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
      activeProps={{
        className: cn(
          "text-foreground bg-muted rounded-md px-3 py-1.5 text-[12px] font-medium",
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
      Sources: Google Scholar &amp; OpenAlex ·{" "}
      <span className="tabular">Saint Louis University</span>
    </footer>
  )
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-200px)] max-w-[1400px] flex-col items-center justify-center px-6 py-16">
      <div className="flex items-center gap-6">
        <div className="bg-primary h-24 w-[3px] rounded-sm" aria-hidden />
        <div>
          <p className="text-muted-foreground tabular text-[11px] font-medium tracking-widest uppercase">
            Error 404
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">
            Page not found
          </h1>
          <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist. It may have
            been moved, or the link may be incorrect.
          </p>
          <div className="mt-6 flex items-center gap-1">
            <Link
              to="/"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
            >
              Back to Explorer
            </Link>
            <Link
              to="/about"
              className="text-muted-foreground hover:text-foreground inline-flex items-center rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
            >
              About this data
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
