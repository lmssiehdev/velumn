export function safeReturnTo(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/servers"
}
