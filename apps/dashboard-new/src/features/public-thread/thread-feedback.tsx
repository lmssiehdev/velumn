import { useId, useRef, useState, useSyncExternalStore } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ThreadVote } from "./contracts"
import { submitThreadVote } from "./functions"

const storageKey = "votedThreads"
const voteChangeEvent = "velumn:thread-vote"
type VoteSnapshot = ThreadVote | "none" | "loading"
const storedVotesSchema = z.record(z.string(), z.enum(["upvote", "downvote"]))

export function ThreadFeedback({
  showEmoji = false,
  threadId,
}: {
  showEmoji?: boolean
  threadId: string
}) {
  const feedback = useThreadFeedback(threadId)
  const {
    disabled,
    failedVote,
    pendingVote,
    questionId,
    selectedVote,
    status,
    statusId,
    submit,
  } = feedback

  return (
    <section
      aria-busy={pendingVote !== null}
      aria-labelledby={questionId}
      className="thread-feedback mt-4 border border-neutral-300 p-4"
    >
      <p
        className="thread-feedback__question m-0 font-medium text-neutral-900"
        id={questionId}
      >
        Did this answer your question?
      </p>
      <div className="thread-feedback__actions mt-3 grid grid-cols-2 gap-2">
        {(["upvote", "downvote"] as const).map((type) => {
          const label = type === "upvote" ? "Yes" : "No"
          const emoji = type === "upvote" ? "1f44d" : "1f44e"
          return (
            <Button
              aria-describedby={statusId}
              aria-pressed={selectedVote === type}
              className={cn(
                "w-full min-w-0",
                selectedVote === type &&
                  "is-selected border-purple-700 bg-purple-50 text-purple-800 opacity-100"
              )}
              disabled={disabled}
              key={type}
              onClick={() => submit(type)}
              size="lg"
              type="button"
              variant="outline"
            >
              {showEmoji && (
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-5"
                  src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${emoji}.svg`}
                />
              )}
              <span>{label}</span>
            </Button>
          )
        })}
      </div>
      <p
        className={cn(
          "thread-feedback__status mt-2 min-h-5 text-[0.8125rem] leading-6 text-neutral-600",
          failedVote && "is-error text-red-800"
        )}
        id={statusId}
        role={failedVote ? "alert" : "status"}
      >
        {status}
        {failedVote && (
          <Button
            className="ms-1 h-auto min-h-7 px-1 align-baseline text-inherit"
            disabled={pendingVote !== null}
            onClick={() => submit(failedVote)}
            size="sm"
            type="button"
            variant="link"
          >
            Try again
          </Button>
        )}
      </p>
    </section>
  )
}

export function useThreadFeedback(
  threadId: string,
  { showServerLoading = true }: { showServerLoading?: boolean } = {}
) {
  const questionId = useId()
  const statusId = useId()
  const storedVote = useSyncExternalStore(
    subscribeToVotes,
    () => readStoredVote(threadId),
    () => (showServerLoading ? "loading" : "none")
  )
  const [submittedVote, setSubmittedVote] = useState<ThreadVote | null>(null)
  const [pendingVote, setPendingVote] = useState<ThreadVote | null>(null)
  const [failedVote, setFailedVote] = useState<ThreadVote | null>(null)
  const submitting = useRef(false)
  const acceptedVote = useRef<ThreadVote | null>(null)

  const selectedVote =
    submittedVote ??
    (storedVote === "upvote" || storedVote === "downvote" ? storedVote : null)
  const loading = storedVote === "loading"
  const disabled = loading || pendingVote !== null || selectedVote !== null
  const status = loading
    ? "Loading feedback options."
    : pendingVote
      ? `Submitting ${pendingVote === "upvote" ? "Yes" : "No"} feedback.`
      : selectedVote
        ? "Thanks for your feedback."
        : failedVote
          ? "Feedback could not be submitted. Check your connection and try again."
          : ""

  async function submit(type: ThreadVote) {
    if (submitting.current || acceptedVote.current || selectedVote) return
    submitting.current = true
    setPendingVote(type)
    setFailedVote(null)

    try {
      const result = await submitThreadVote({ data: { threadId, type } })
      if (result.status === "error") {
        setFailedVote(type)
        return
      }

      acceptedVote.current = type
      setSubmittedVote(type)
      storeVote(threadId, type)
    } catch {
      setFailedVote(type)
    } finally {
      submitting.current = false
      setPendingVote(null)
    }
  }

  return {
    disabled,
    failedVote,
    pendingVote,
    questionId,
    selectedVote,
    status,
    statusId,
    submit,
  }
}

function subscribeToVotes(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(voteChangeEvent, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(voteChangeEvent, onStoreChange)
  }
}

function readStoredVote(threadId: string): VoteSnapshot {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return "none"
    const votes = storedVotesSchema.safeParse(JSON.parse(stored))
    if (!votes.success) return "none"
    const vote = votes.data[threadId]
    return vote === "upvote" || vote === "downvote" ? vote : "none"
  } catch {
    return "none"
  }
}

function storeVote(threadId: string, vote: ThreadVote) {
  try {
    const stored = localStorage.getItem(storageKey)
    const votes = stored
      ? storedVotesSchema.catch({}).parse(JSON.parse(stored))
      : {}
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...votes, [threadId]: vote })
    )
  } catch {
    // The in-memory success state still prevents another vote in this session.
  }
  window.dispatchEvent(new Event(voteChangeEvent))
}
