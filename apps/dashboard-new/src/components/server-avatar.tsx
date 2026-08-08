import { Hash } from "lucide-react"

import { cn } from "@/lib/utils"

export function ServerAvatar({
  name,
  icon,
  className,
}: {
  name: string
  icon?: string | null
  className?: string
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg border bg-muted text-xs font-medium text-foreground",
        className
      )}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          className="size-full rounded-[inherit] object-cover"
        />
      ) : (
        initials || <Hash className="size-4" />
      )}
    </span>
  )
}
