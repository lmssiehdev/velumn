import { Check } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function OnboardingFrame({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-[calc(100svh-3.5rem)] justify-center bg-background px-5 py-10 text-foreground sm:px-8 sm:py-14">
      <div className="w-full max-w-2xl">{children}</div>
    </section>
  )
}

export function OnboardingProgress({ current }: { current: number }) {
  const steps = ["Choose server", "Connect bot", "Select channels"]

  return (
    <div
      className="flex items-center gap-2"
      aria-label={`Step ${current} of 3`}
    >
      {steps.map((step, index) => (
        <div key={step} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full border text-[0.65rem] font-semibold",
              index + 1 <= current
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {index + 1 < current ? <Check className="size-3" /> : index + 1}
          </span>
          <span className="hidden truncate text-xs text-muted-foreground sm:block">
            {step}
          </span>
          {index < steps.length - 1 && (
            <span className="h-px flex-1 bg-border" />
          )}
        </div>
      ))}
    </div>
  )
}

export function OnboardingHeading({
  description,
  eyebrow,
  title,
}: {
  description: string
  eyebrow: string
  title: ReactNode
}) {
  return (
    <div className="max-w-xl">
      <p className="text-xs font-medium tracking-[0.18em] text-chart-4 uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-4xl leading-[1.04] tracking-[-0.05em] text-balance sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-lg text-base leading-7 text-pretty text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
