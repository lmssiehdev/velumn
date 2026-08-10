import { Check, Hash, MessageSquareText } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import type { SelectableChannel } from "./selection"

export function ChannelSelectionRow({
  channel,
  detail,
  disabled = false,
  selected,
  trailing,
  onToggle,
}: {
  channel: SelectableChannel
  detail: string
  disabled?: boolean
  selected: boolean
  trailing?: ReactNode
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-65",
        selected && "bg-accent/60"
      )}
      onClick={onToggle}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded border",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background"
        )}
        aria-hidden="true"
      >
        {selected && <Check className="size-3" />}
      </span>
      {channel.type === "forum" ? (
        <MessageSquareText className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <Hash className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          #{channel.name}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
      {trailing}
    </button>
  )
}
