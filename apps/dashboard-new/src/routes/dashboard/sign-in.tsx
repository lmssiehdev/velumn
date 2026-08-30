import { createFileRoute, redirect } from "@tanstack/react-router"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { getAuthAvailability } from "@/lib/auth-functions"
import { safeReturnTo } from "@/lib/safe-return-to"

const signInSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  error: z.string().optional().catch(undefined),
})

function parseSignInSearch(
  search: Parameters<typeof signInSearchSchema.parse>[0]
) {
  return signInSearchSchema.parse(search)
}

export const Route = createFileRoute("/dashboard/sign-in")({
  validateSearch: parseSignInSearch,
  beforeLoad: async ({ search }) => {
    const { getSession } = await import("@/lib/auth-functions")
    const session = await getSession()
    if (session) throw redirect({ href: safeReturnTo(search.redirect) })
  },
  loader: () => getAuthAvailability(),
  component: SignInPage,
})

function SignInPage() {
  const { redirect: returnUrl, error: oauthError } = Route.useSearch()
  const authAvailability = Route.useLoaderData()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setPending(true)
    setError(null)

    const callbackURL = safeReturnTo(returnUrl)
    const errorSearch = new URLSearchParams({
      error: "oauth",
      redirect: callbackURL,
    })

    const result = await authClient.signIn.social({
      provider: "discord",
      callbackURL,
      errorCallbackURL: `/dashboard/sign-in?${errorSearch}`,
    })

    if (result.error) {
      setPending(false)
      setError("Discord sign-in could not be started. Please try again.")
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-6 py-12">
      <section className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-7" />
          <span className="font-semibold tracking-tight">velumn</span>
        </div>
        <h1 className="mt-8 text-xl font-semibold tracking-tight">
          Sign in to your account
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sign in with the Discord account that manages your servers.
        </p>

        <Button
          size="lg"
          className="mt-6 h-10 w-full bg-[#5865f2] hover:bg-[#4c58dd]"
          disabled={pending || !authAvailability.discord}
          aria-busy={pending}
          onClick={signIn}
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <DiscordMark />
          )}
          {pending ? "Opening Discord..." : "Continue with Discord"}
        </Button>

        {!authAvailability.discord && (
          <p className="mt-3 text-xs text-muted-foreground">
            Discord sign-in is not configured for this environment.
          </p>
        )}

        {(error || oauthError) && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            {error ?? "Discord sign-in failed. Please try again."}
          </p>
        )}
      </section>
    </main>
  )
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M19.5 5.3A18 18 0 0 0 15.1 4l-.5 1a16 16 0 0 0-5.2 0l-.5-1a18 18 0 0 0-4.4 1.3C1.7 9.5 1 13.5 1.4 17.4A18 18 0 0 0 6.8 20l1.3-1.8a11 11 0 0 1-2-1l.5-.4a13 13 0 0 0 10.8 0l.5.4a11 11 0 0 1-2 1l1.3 1.8a18 18 0 0 0 5.4-2.6c.5-4.5-.8-8.4-3.1-12.1ZM8.7 15.2c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.9 2.2-1.9 2.2Zm6.6 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Z" />
    </svg>
  )
}
