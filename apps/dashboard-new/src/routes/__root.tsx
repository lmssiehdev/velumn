import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import appCss from "../globals.css?url"
import type { RouterContext } from "@/lib/query-client"

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Velumn Dashboard",
      },
      {
        name: "description",
        content: "Manage your Velumn Discord publishing workspace.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: Outlet,
  notFoundComponent: () => (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          This page drifted out of view.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The dashboard route you requested does not exist or is no longer
          available.
        </p>
      </div>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh antialiased">
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
