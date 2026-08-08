import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDot,
  FileText,
  Globe2,
  RadioTower,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { getServerOverview } from "@/features/dashboard/server"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_dashboard/servers/$serverId/")({
  loader: async ({ params }) => {
    const result = await getServerOverview({
      data: { serverId: params.serverId },
    })
    if (result.status === "error") throw notFound()
    return { overview: result.overview }
  },
  component: ServerOverviewPage,
})

function ServerOverviewPage() {
  const { overview } = Route.useLoaderData()
  const { serverId } = Route.useParams()
  const disconnected = overview.bot.status === "disconnected"

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {disconnected && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-50 px-4 py-3 text-sm sm:flex-row sm:items-center">
          <span className="flex items-center gap-2 font-medium text-amber-900">
            <CircleDot className="size-4 text-amber-600" /> Velumn lost contact
            with the Discord bot.
          </span>
          <Link
            to="/servers/$serverId/setup"
            params={{ serverId }}
            className="text-left text-xs font-semibold text-amber-800 underline underline-offset-4 sm:ml-auto"
          >
            Reconnect bot
          </Link>
        </div>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {overview.server.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connection, indexing, content coverage, and publishing at a glance.
          </p>
        </div>
        <a href={overview.forumUrl} className={buttonVariants()}>
          Visit forum <ArrowUpRight data-icon="inline-end" />
        </a>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatusCard
          eyebrow="Connection"
          title={disconnected ? "Disconnected" : "Bot online"}
          description={
            disconnected
              ? "Reconnect to resume Discord operations."
              : "Listening for new and updated threads."
          }
          icon={RadioTower}
          tone={disconnected ? "warning" : "positive"}
        />
        <StatusCard
          eyebrow="Coverage"
          title={`${overview.channels.enabled} of ${overview.channels.eligible} channels`}
          description={`${overview.threads.total.toLocaleString()} published threads available.`}
          icon={FileText}
        />
        <StatusCard
          eyebrow="Publishing"
          title={overview.publishing.domain ?? "Default domain"}
          description={
            overview.publishing.status === "verified"
              ? "Custom domain verified and serving."
              : "Publishing on velumn.com."
          }
          icon={Globe2}
          tone={
            overview.publishing.status === "verified" ? "positive" : "neutral"
          }
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Recently indexed</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The latest conversations published from Discord.
            </p>
          </div>
          <Link
            to="/servers/$serverId/threads"
            params={{ serverId }}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="divide-y">
          {overview.threads.recent.length === 0 && (
            <p className="px-5 py-8 text-center text-xs text-muted-foreground">
              No threads have been indexed yet.
            </p>
          )}
          {overview.threads.recent.map((thread) => (
            <a
              key={thread.id}
              href={thread.publicUrl}
              className="group grid gap-2 px-5 py-4 transition-colors hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium group-hover:text-primary">
                  {thread.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  #{thread.parentChannel.name}
                </p>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums sm:text-right">
                {thread.messageCount} messages
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatusCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = "neutral",
}: {
  eyebrow: string
  title: string
  description: string
  icon: typeof RadioTower
  tone?: "neutral" | "positive" | "warning"
}) {
  return (
    <article className="min-h-40 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {eyebrow}
        </span>
        <span
          className={cn(
            "grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground",
            tone === "positive" && "bg-emerald-500/10 text-emerald-700",
            tone === "warning" && "bg-amber-500/10 text-amber-700"
          )}
        >
          {tone === "positive" ? (
            <Check className="size-4" />
          ) : (
            <Icon className="size-4" />
          )}
        </span>
      </div>
      <div className="mt-6">
        <h2 className="truncate text-base font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </article>
  )
}
