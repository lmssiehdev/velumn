import { useId, useRef, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import type { ThreadVote } from "./contracts"
import { submitThreadVote } from "./functions"

const storageKey = "votedThreads"
const voteChangeEvent = "velumn:thread-vote"
type VoteSnapshot = ThreadVote | "none" | "loading"

export function ThreadFeedback({ threadId }: { threadId: string }) {
  const questionId = useId()
  const statusId = useId()
  const storedVote = useSyncExternalStore(
    subscribeToVotes,
    () => readStoredVote(threadId),
    () => "loading"
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

  return (
    <section
      aria-busy={pendingVote !== null}
      aria-labelledby={questionId}
      className="thread-feedback"
    >
      <p className="thread-feedback__question" id={questionId}>
        Did this answer your question?
      </p>
      <div className="thread-feedback__actions">
        {(["upvote", "downvote"] as const).map((type) => {
          const label = type === "upvote" ? "Yes" : "No"
          return (
            <Button
              aria-describedby={statusId}
              aria-pressed={selectedVote === type}
              className={selectedVote === type ? "is-selected" : undefined}
              disabled={disabled}
              key={type}
              onClick={() => submit(type)}
              size="lg"
              type="button"
              variant="outline"
            >
              {label}
            </Button>
          )
        })}
      </div>
      <p
        className={`thread-feedback__status${failedVote ? " is-error" : ""}`}
        id={statusId}
        role={failedVote ? "alert" : "status"}
      >
        {status}
        {failedVote && (
          <Button
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
    const votes: unknown = JSON.parse(stored)
    if (typeof votes !== "object" || votes === null) return "none"
    const vote = (votes as Record<string, unknown>)[threadId]
    return vote === "upvote" || vote === "downvote" ? vote : "none"
  } catch {
    return "none"
  }
}

function storeVote(threadId: string, vote: ThreadVote) {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed: unknown = stored ? JSON.parse(stored) : {}
    const votes =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
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
