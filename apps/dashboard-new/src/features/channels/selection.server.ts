import { setServerChannelSelection } from "@repo/db/helpers/channels"
import { Result, TaggedError, type Result as ResultType } from "better-result"

export class ChannelSelectionChanged extends TaggedError(
  "ChannelSelectionChanged"
)<{ message: string }> {}

export class ChannelSelectionRequired extends TaggedError(
  "ChannelSelectionRequired"
)<{ message: string }> {}

export class ChannelSelectionUnavailable extends TaggedError(
  "ChannelSelectionUnavailable"
)<{ cause: unknown; message: string }> {}

type ChannelSelectionFailure =
  | ChannelSelectionChanged
  | ChannelSelectionRequired
  | ChannelSelectionUnavailable

export async function validateAndPersistChannelSelection({
  availableChannelIds,
  selectedChannelIds,
  serverId,
  submittedChannelIds,
}: {
  availableChannelIds: readonly string[]
  selectedChannelIds: readonly string[]
  serverId: string
  submittedChannelIds?: readonly string[]
}): Promise<ResultType<void, ChannelSelectionFailure>> {
  const availableIds = new Set(availableChannelIds)
  const selectedIds = new Set(selectedChannelIds)

  if (
    availableIds.size !== availableChannelIds.length ||
    selectedIds.size !== selectedChannelIds.length ||
    selectedChannelIds.some((channelId) => !availableIds.has(channelId))
  ) {
    return Result.err(
      new ChannelSelectionChanged({
        message:
          "The channel list changed in Discord. Refresh and review your selection.",
      })
    )
  }

  if (submittedChannelIds) {
    const submittedIds = new Set(submittedChannelIds)
    if (
      submittedIds.size !== submittedChannelIds.length ||
      submittedIds.size !== availableIds.size ||
      availableChannelIds.some((channelId) => !submittedIds.has(channelId))
    ) {
      return Result.err(
        new ChannelSelectionChanged({
          message:
            "The channel list changed in Discord. Refresh and review your selection.",
        })
      )
    }
  }

  if (selectedIds.size === 0) {
    return Result.err(
      new ChannelSelectionRequired({
        message: "Keep at least one channel enabled for indexing.",
      })
    )
  }

  return Result.tryPromise({
    try: () =>
      setServerChannelSelection({
        serverId,
        channels: availableChannelIds.map((channelId) => ({
          channelId,
          status: selectedIds.has(channelId),
        })),
      }),
    catch: (cause) =>
      new ChannelSelectionUnavailable({
        cause,
        message: "Channel settings could not be saved. Try again.",
      }),
  })
}
