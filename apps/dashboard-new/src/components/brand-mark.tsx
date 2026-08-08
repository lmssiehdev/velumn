import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-8 place-items-center overflow-hidden rounded-lg bg-primary",
        className
      )}
    >
      <span className="absolute top-[7px] h-[2px] w-3.5 rotate-[-18deg] rounded-full bg-white/90" />
      <span className="absolute top-[14px] h-[2px] w-4 rotate-[-18deg] rounded-full bg-white/90" />
      <span className="absolute top-[21px] h-[2px] w-2.5 rotate-[-18deg] rounded-full bg-white/90" />
    </span>
  )
}
