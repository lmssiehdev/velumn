export type ChannelTypeFilter = "all" | "forum" | "text"

export type SelectableChannel = {
  id: string
  name: string
  type: "forum" | "text"
}

export function filterChannels<T extends SelectableChannel>(
  channels: Array<T>,
  search: string,
  type: ChannelTypeFilter
) {
  const normalizedSearch = search.trim().toLowerCase()
  return channels.filter(
    (channel) =>
      (type === "all" || channel.type === type) &&
      (!normalizedSearch ||
        channel.name.toLowerCase().includes(normalizedSearch))
  )
}

export function selectionsEqual(left: Set<string>, right: Set<string>) {
  return (
    left.size === right.size &&
    [...left].every((channelId) => right.has(channelId))
  )
}

export function countSelectionChanges(
  baseline: Set<string>,
  selected: Set<string>
) {
  let count = 0
  for (const channelId of baseline) if (!selected.has(channelId)) count += 1
  for (const channelId of selected) if (!baseline.has(channelId)) count += 1
  return count
}
