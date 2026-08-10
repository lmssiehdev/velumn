import { useState } from "react"

import { countSelectionChanges, selectionsEqual } from "./selection"

export function useChannelSelection(initialIds: Iterable<string>) {
  const [baseline] = useState(() => new Set(initialIds))
  const [selectedIds, setSelectedIds] = useState(() => new Set(baseline))

  const toggle = (channelId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(channelId)) next.delete(channelId)
      else next.add(channelId)
      return next
    })
  }

  const setMany = (channelIds: Iterable<string>, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const channelId of channelIds) {
        if (selected) next.add(channelId)
        else next.delete(channelId)
      }
      return next
    })
  }

  const reset = () => setSelectedIds(new Set(baseline))

  return {
    changeCount: countSelectionChanges(baseline, selectedIds),
    dirty: !selectionsEqual(baseline, selectedIds),
    reset,
    selectedIds,
    setMany,
    toggle,
  }
}
