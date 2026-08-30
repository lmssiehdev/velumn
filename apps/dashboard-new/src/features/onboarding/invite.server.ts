import { createBotInvite } from "@repo/db/helpers/servers"
import { Result, TaggedError, type Result as ResultType } from "better-result"

export class InviteAlreadyClaimed extends TaggedError("InviteAlreadyClaimed")<{
  message: string
}> {}

export class InvitePreparationUnavailable extends TaggedError(
  "InvitePreparationUnavailable"
)<{ cause: unknown; message: string }> {}

export async function prepareServerInvite(input: {
  userId: string
  serverId: string
}): Promise<
  ResultType<void, InviteAlreadyClaimed | InvitePreparationUnavailable>
> {
  const result = await Result.tryPromise({
    try: () => createBotInvite(input),
    catch: (cause) => cause,
  })
  if (result.isOk()) return Result.ok(undefined)

  if (
    result.error instanceof Error &&
    result.error.message ===
      "A different user is already installing this server"
  ) {
    return Result.err(
      new InviteAlreadyClaimed({
        message: "A different user is already installing this server.",
      })
    )
  }

  return Result.err(
    new InvitePreparationUnavailable({
      cause: result.error,
      message: "This server could not be prepared. Try again.",
    })
  )
}
