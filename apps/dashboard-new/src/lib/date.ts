type DateInput = string | number | Date

const relativeFormatter = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
})
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
})
const localTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeStyle: "medium",
})
const localDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "medium",
})
const utcShortDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})
const utcLongDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
})
const utcShortDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
})
export function formatRelativeDate(value: DateInput) {
  let amount = Math.round((toDate(value).getTime() - Date.now()) / 1000)
  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ]

  for (const [range, unit] of ranges) {
    if (Math.abs(amount) < range) {
      return relativeFormatter.format(Math.round(amount), unit)
    }
    amount /= range
  }
  return fullDateFormatter.format(toDate(value))
}

export function formatFullDate(value: DateInput) {
  return fullDateFormatter.format(toDate(value))
}

export function formatLocalTime(value: DateInput) {
  return localTimeFormatter.format(toDate(value))
}

export function formatLocalDateTime(value: DateInput) {
  return localDateTimeFormatter.format(toDate(value))
}

export function formatUtcDate(
  value: DateInput,
  length: "short" | "long" = "short"
) {
  return (
    length === "long" ? utcLongDateFormatter : utcShortDateFormatter
  ).format(toDate(value))
}

export function formatUtcShortDateTime(value: DateInput) {
  return utcShortDateTimeFormatter.format(toDate(value))
}

function toDate(value: DateInput) {
  return value instanceof Date ? value : new Date(value)
}
