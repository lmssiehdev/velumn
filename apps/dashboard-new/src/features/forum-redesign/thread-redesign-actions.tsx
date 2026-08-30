import { ArrowUpRight } from "lucide-react"

import type { ThreadVote } from "@/features/public-thread/contracts"
import { useThreadFeedback } from "@/features/public-thread/thread-feedback"

const choices = [
  { type: "upvote", label: "Yes", emoji: "1f44d" },
  { type: "downvote", label: "No", emoji: "1f44e" },
] as const

export function ThreadRedesignFeedback({ threadId }: { threadId: string }) {
  const feedback = useThreadFeedback(threadId, { showServerLoading: false })

  return (
    <section
      aria-busy={feedback.pendingVote !== null}
      aria-labelledby={feedback.questionId}
      className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#deddd7] bg-[#f7f6f2] px-3 py-2.5"
    >
      <span className="text-xs text-[#69665e]" id={feedback.questionId}>
        Was this helpful?
      </span>
      <div className="inline-flex rounded-lg border border-[#d6d4cd] bg-white p-0.5">
        {choices.map((choice) => (
          <FeedbackButton
            choice={choice}
            disabled={feedback.disabled}
            key={choice.type}
            onClick={() => feedback.submit(choice.type)}
            selected={feedback.selectedVote === choice.type}
            statusId={feedback.statusId}
          />
        ))}
      </div>
      <span
        className={
          feedback.failedVote
            ? "basis-full text-right text-[0.6875rem] leading-tight text-[#991b1b]"
            : "sr-only"
        }
        id={feedback.statusId}
        role={feedback.failedVote ? "alert" : "status"}
      >
        {feedback.status}
        {feedback.failedVote && (
          <button
            className="ml-1 cursor-pointer border-0 bg-transparent p-0 font-[inherit] underline underline-offset-2"
            disabled={feedback.pendingVote !== null}
            onClick={() => feedback.submit(feedback.failedVote as ThreadVote)}
            type="button"
          >
            Try again
          </button>
        )}
      </span>
    </section>
  )
}

export function ThreadRedesignContinue({
  discordUrl,
  noReplies,
}: {
  discordUrl: string
  noReplies: boolean
}) {
  return (
    <section className="mt-5 flex flex-col gap-4 rounded-xl border border-[#deddd7] bg-[#f7f6f2] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <img
          alt=""
          aria-hidden="true"
          className="size-8 shrink-0"
          src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4ac.svg"
        />
        <div className="min-w-0">
          <h2 className="m-0 text-base font-normal text-[#24231f]">
            {noReplies ? "Start the conversation" : "Continue the discussion"}
          </h2>
          <p className="m-0 mt-0.5 text-xs text-[#69665e]">
            {noReplies
              ? "Be the first to reply on Discord."
              : "Reply with the community on Discord."}
          </p>
        </div>
      </div>
      <a
        className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-[#24231f] bg-[#24231f] px-3 text-xs !text-white no-underline transition-colors hover:bg-[#3a3832] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#24231f] sm:self-auto"
        href={discordUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        {noReplies ? "Reply in Discord" : "Open in Discord"}
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </a>
    </section>
  )
}

function FeedbackButton({
  choice,
  disabled,
  onClick,
  selected,
  statusId,
}: {
  choice: { type: ThreadVote; label: string; emoji: string }
  disabled: boolean
  onClick: () => void
  selected: boolean
  statusId: string
}) {
  return (
    <button
      aria-describedby={statusId}
      aria-pressed={selected}
      className={`inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md border-0 px-2 text-xs text-[#555149] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#24231f] disabled:cursor-default disabled:opacity-50 ${selected ? "bg-[#eef1eb] text-[#384334]" : "bg-transparent hover:bg-[#f1efe9]"}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <img
        alt=""
        aria-hidden="true"
        className="size-3.5"
        src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${choice.emoji}.svg`}
      />
      {choice.label}
    </button>
  )
}
