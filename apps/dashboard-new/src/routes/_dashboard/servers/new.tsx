import { Link, createFileRoute } from "@tanstack/react-router"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { ArrowRight, Search, ShieldCheck } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { z } from "zod"

import { ServerAvatar } from "@/components/server-avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  OnboardingFrame,
  OnboardingHeading,
  OnboardingProgress,
} from "@/features/onboarding/components"
import { trackOnboardingEvent } from "@/features/onboarding/analytics"
import { eligibleDiscordServersQueryOptions } from "@/features/onboarding/queries"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const serverSearchSchema = z.object({ q: z.string().optional() })

export const Route = createFileRoute("/_dashboard/servers/new")({
  validateSearch: serverSearchSchema,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      eligibleDiscordServersQueryOptions(context.user.id)
    ),
  component: AddServerPage,
})

const installationCopy = {
  not_added: { label: "Not added", action: "Add server" },
  awaiting_bot: { label: "Waiting for bot", action: "Check connection" },
  selecting_channels: {
    label: "Channels needed",
    action: "Continue setup",
  },
  bot_disconnected: { label: "Bot disconnected", action: "Reconnect bot" },
  ready: { label: "Already live", action: "View status" },
} as const

function AddServerPage() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const { data: result } = useSuspenseQuery(
    eligibleDiscordServersQueryOptions(user.id)
  )
  const { q } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [reconnecting, setReconnecting] = useState(false)
  const query = useDeferredValue(q?.trim().toLowerCase() ?? "")
  const filteredServers =
    result.status === "ok"
      ? result.servers.filter((server) =>
          server.name.toLowerCase().includes(query)
        )
      : []

  if (result.status === "error") {
    return (
      <OnboardingFrame>
        <OnboardingProgress current={1} />
        <div className="mt-12">
          <OnboardingHeading
            eyebrow="Discord connection"
            title="Your server list is temporarily out of reach."
            description={result.message}
          />
        </div>
        <Card className="mt-8 max-w-xl">
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            {result.code === "discord_reauth_required" ? (
              <Button
                disabled={reconnecting}
                onClick={async () => {
                  setReconnecting(true)
                  try {
                    await authClient.linkSocial({
                      provider: "discord",
                      callbackURL: "/servers/new",
                    })
                  } finally {
                    setReconnecting(false)
                  }
                }}
              >
                {reconnecting ? "Connecting…" : "Reconnect Discord"}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: eligibleDiscordServersQueryOptions(user.id)
                      .queryKey,
                  })
                }
              >
                Try again
              </Button>
            )}
            <Link
              to="/servers"
              className={buttonVariants({ variant: "outline" })}
            >
              Return to servers
            </Link>
          </CardContent>
        </Card>
      </OnboardingFrame>
    )
  }

  return (
    <OnboardingFrame>
      <OnboardingProgress current={1} />
      <div className="mt-12">
        <OnboardingHeading
          eyebrow="Choose your community"
          title="Your Discord already has answers worth finding."
          description="Pick the server where useful conversations keep getting buried. Setup takes a few minutes, and you choose exactly what gets published."
        />
      </div>

      <div className="relative mt-9">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q ?? ""}
          onChange={(event) =>
            navigate({
              search: { q: event.target.value || undefined },
              replace: true,
            })
          }
          placeholder="Search your Discord servers"
          aria-label="Search your Discord servers"
          className="h-10 pl-9"
        />
      </div>

      <div className="mt-4 space-y-2.5">
        {result.servers.length === 0 && (
          <Card className="border-dashed bg-transparent py-0 shadow-none">
            <CardContent className="py-10 text-center">
              <CardTitle className="text-sm">
                No manageable servers found
              </CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-sm">
                Discord only returns servers where you are the owner or have
                Manage Server permission.
              </CardDescription>
            </CardContent>
          </Card>
        )}

        {filteredServers.map((server) => {
          const copy = installationCopy[server.installation]
          const isReady = server.installation === "ready"

          return (
            <Card
              key={server.id}
              size="sm"
              className="py-0 transition-colors hover:ring-foreground/30"
            >
              <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ServerAvatar
                    name={server.name}
                    icon={server.icon}
                    className="size-10 bg-primary text-primary-foreground"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="truncate text-sm">
                        {server.name}
                      </CardTitle>
                      <Badge variant="outline" className="font-normal">
                        {server.owner ? "Owner" : "Manager"}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1 text-xs">
                      {copy.label}
                    </CardDescription>
                  </div>
                </div>
                <Link
                  to="/servers/$serverId/setup"
                  params={{ serverId: server.id }}
                  onClick={() =>
                    void trackOnboardingEvent({
                      data: {
                        event: "server_selected",
                        properties: { installation: server.installation },
                        serverId: server.id,
                      },
                    })
                  }
                  className={cn(
                    buttonVariants({
                      variant: isReady ? "outline" : "default",
                    }),
                    "rounded-full px-4 sm:min-w-36"
                  )}
                >
                  {copy.action} <ArrowRight data-icon="inline-end" />
                </Link>
              </CardContent>
            </Card>
          )
        })}

        {result.servers.length > 0 && filteredServers.length === 0 && (
          <Card className="border-dashed bg-transparent py-0 shadow-none">
            <CardContent className="py-10 text-center">
              <CardTitle className="text-sm">No servers match “{q}”</CardTitle>
              <button
                className="mt-2 text-sm text-primary hover:underline"
                onClick={() => navigate({ search: {}, replace: true })}
              >
                Clear search
              </button>
            </CardContent>
          </Card>
        )}
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Only servers where you have Manage
        Server permission are shown. Nothing goes public during setup.
      </p>
    </OnboardingFrame>
  )
}
