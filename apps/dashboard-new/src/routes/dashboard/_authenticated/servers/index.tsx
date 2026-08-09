import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, ArrowUpRight, Plus, RadioTower } from "lucide-react"

import { ServerAvatar } from "@/components/server-avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { serverLifecycleLabels } from "@/features/dashboard/contracts"
import { getServers } from "@/features/dashboard/server"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/dashboard/_authenticated/servers/")({
  loader: async () => ({ servers: await getServers() }),
  component: ServersPage,
})

function ServersPage() {
  const { servers } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Servers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a Discord community to monitor, index, and publish.
          </p>
        </div>
        <Link to="/dashboard/servers/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" /> Add server
        </Link>
      </header>

      {servers.length === 0 && (
        <section className="mt-6 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <h2 className="text-sm font-semibold">No servers yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Connect a Discord community to start indexing and publishing its
            conversations.
          </p>
          <Link
            to="/dashboard/servers/new"
            className={cn(buttonVariants(), "mt-5")}
          >
            <Plus data-icon="inline-start" /> Add server
          </Link>
        </section>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {servers.map((server) => {
          const isReady = server.lifecycle === "ready"
          const action = isReady
            ? "Open dashboard"
            : server.lifecycle === "setup_required"
              ? "Continue setup"
              : "Reconnect bot"

          return (
            <article
              key={server.id}
              className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-start gap-3">
                <ServerAvatar name={server.name} className="size-10" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">
                      {server.name}
                    </h2>
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-1.5 py-0 text-[0.65rem] font-normal",
                        isReady &&
                          "border-emerald-600/20 bg-emerald-500/8 text-emerald-700",
                        server.lifecycle === "bot_disconnected" &&
                          "border-amber-600/20 bg-amber-500/8 text-amber-700"
                      )}
                    >
                      {serverLifecycleLabels[server.lifecycle]}
                    </Badge>
                  </div>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-xs">
                <div>
                  <dt className="text-muted-foreground">Indexed channels</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {server.enabledChannelCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Threads</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {server.indexedThreadCount.toLocaleString()}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex items-center gap-2">
                {server.forumUrl && (
                  <a
                    href={server.forumUrl}
                    aria-label={`Visit ${server.name} forum`}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                    })}
                  >
                    <ArrowUpRight />
                  </a>
                )}
                <Link
                  to={
                    server.lifecycle === "ready"
                      ? "/dashboard/servers/$serverId"
                      : "/dashboard/servers/$serverId/setup"
                  }
                  params={{ serverId: server.id }}
                  className={buttonVariants({
                    variant: isReady ? "outline" : "default",
                    size: "default",
                  })}
                >
                  {action} <ArrowRight data-icon="inline-end" />
                </Link>
              </div>
            </article>
          )
        })}
      </section>

      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <RadioTower className="size-3.5" />
        Bot status refreshes independently from indexed content.
      </div>
    </div>
  )
}
