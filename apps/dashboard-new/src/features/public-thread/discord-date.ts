const timestampFormatters = {
  t: new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }),
  T: new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }),
  d: new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }),
  D: new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }),
  F: new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  }),
  f: new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }),
  R: new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }),
}

export function formatDiscordTimestamp(value: string, style: string) {
  const date = new Date(Number(value) * 1000)
  const formatter = Object.hasOwn(timestampFormatters, style)
    ? timestampFormatters[style as keyof typeof timestampFormatters]
    : timestampFormatters.f
  const formatted = formatter.format(date)
  return style === "R" ? `Relative time: ${formatted}` : formatted
}
