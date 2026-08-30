import { Link, Outlet, useMatchRoute } from "@tanstack/react-router"
import {
  BookOpen,
  CircleHelp,
  CreditCard,
  FileText,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  RadioTower,
  Settings2,
} from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { ServerAvatar } from "@/components/server-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { DashboardShell as DashboardShellData } from "@/features/dashboard/contracts"
import { serverLifecycleLabels } from "@/features/dashboard/contracts"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const navigation = [
  { label: "Overview", icon: LayoutDashboard, path: "" },
  { label: "Threads", icon: FileText, path: "/threads" },
  { label: "Channels", icon: RadioTower, path: "/channels" },
  { label: "Publishing", icon: Globe2, path: "/publishing" },
  { label: "Billing", icon: CreditCard, path: "/billing" },
] as const

export function DashboardShell({ shell }: { shell: DashboardShellData }) {
  const matchRoute = useMatchRoute()
  const isSetupFlow = Boolean(
    matchRoute({ to: "/dashboard/servers/new", fuzzy: true }) ||
    matchRoute({ to: "/dashboard/servers/$serverId/setup", fuzzy: true })
  )
  const params = matchRoute({
    to: "/dashboard/servers/$serverId",
    fuzzy: true,
  })
  const serverId = params ? params.serverId : null
  const activeServer = shell.servers.find((server) => server.id === serverId)

  if (isSetupFlow) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <header className="flex h-14 items-center border-b bg-background px-5 sm:px-8">
          <Link to="/dashboard/servers" className="flex items-center gap-2.5">
            <BrandMark className="size-6 rounded-md" />
            <span className="text-sm font-semibold tracking-[-0.02em]">
              velumn
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              turn conversations into answers
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="https://velumn.app"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Help
            </a>
            <span className="mx-1 h-4 w-px bg-border" />
            <Link
              to="/dashboard/servers"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Exit setup
            </Link>
          </div>
        </header>
        <main className="min-h-[calc(100svh-3.5rem)]">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col overflow-hidden border-r bg-background lg:flex">
        <ShellNavigation shell={shell} activeServerId={serverId} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-background px-4">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="lg:hidden" />
              }
            >
              <Menu />
              <span className="sr-only">Open navigation</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Switch servers and navigate dashboard sections.
              </SheetDescription>
              <ShellNavigation shell={shell} activeServerId={serverId} />
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Link
              to="/dashboard/servers"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Servers
            </Link>
            {activeServer && (
              <>
                <span className="text-border">/</span>
                <span className="truncate font-medium">
                  {activeServer.name}
                </span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              <CircleHelp data-icon="inline-start" />
              Help
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="grid size-7 place-items-center rounded-full bg-muted text-[0.65rem] font-semibold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40" />
                }
              >
                {shell.user.name.slice(0, 2).toUpperCase()}
                <span className="sr-only">Open user menu</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="py-2">
                    <span className="block truncate text-sm text-foreground">
                      {shell.user.name}
                    </span>
                    <span className="mt-0.5 block truncate font-normal text-muted-foreground">
                      {shell.user.email}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    authClient.signOut({
                      fetchOptions: {
                        onSuccess: () => {
                          window.location.href = "/dashboard/sign-in"
                        },
                      },
                    })
                  }
                >
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-h-[calc(100svh-3rem)] bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function ShellNavigation({
  shell,
  activeServerId,
}: {
  shell: DashboardShellData
  activeServerId: string | null
}) {
  const matchRoute = useMatchRoute()
  const activeServer = shell.servers.find(
    (server) => server.id === activeServerId
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2.5 border-b px-4">
        <BrandMark className="size-6 rounded-md" />
        <span className="font-semibold tracking-[-0.02em]">velumn</span>
      </div>

      <div className="px-4 pt-6 pb-2">
        <Link
          to={
            activeServer ? "/dashboard/servers/$serverId" : "/dashboard/servers"
          }
          params={activeServer ? { serverId: activeServer.id } : {}}
          className="flex w-full items-center gap-2 rounded-lg bg-secondary px-2 py-2 text-left transition-colors hover:bg-muted"
        >
          {activeServer ? (
            <ServerAvatar name={activeServer.name} className="size-6" />
          ) : (
            <span className="grid size-6 place-items-center rounded-lg border bg-background">
              <BookOpen className="size-3.5 text-muted-foreground" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">
              {activeServer?.name ?? "All servers"}
            </span>
            <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">
              {activeServer
                ? serverLifecycleLabels[activeServer.lifecycle]
                : `${shell.servers.length} workspaces`}
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-4">
        <p className="mb-2 px-2 text-xs font-medium text-muted-foreground/70">
          {activeServer ? "Manage" : "Workspace"}
        </p>
        {activeServer ? (
          <div className="space-y-1">
            {navigation.map((item) => {
              const to = `/dashboard/servers/${activeServer.id}${item.path}`
              const active = item.path
                ? Boolean(matchRoute({ to, fuzzy: true }))
                : Boolean(matchRoute({ to, fuzzy: false }))

              return (
                <Link
                  key={item.label}
                  to={to}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    active && "bg-accent text-accent-foreground"
                  )}
                >
                  <item.icon className="size-4" strokeWidth={1.8} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ) : (
          <Link
            to="/dashboard/servers"
            className="flex h-9 items-center gap-2 rounded-lg bg-accent px-2 text-sm font-medium text-accent-foreground"
          >
            <Settings2 className="size-4" />
            Servers
          </Link>
        )}
      </nav>

      <div className="space-y-1 px-4 pb-6">
        <a
          href="https://velumn.app"
          className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CircleHelp className="size-4" /> Documentation
        </a>
      </div>
    </div>
  )
}
