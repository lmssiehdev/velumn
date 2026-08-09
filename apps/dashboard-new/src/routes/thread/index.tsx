import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/thread/")({
  headers: () => ({ "Cache-Control": "no-store" }),
  head: () => ({
    meta: [
      { title: "Discussion not found | Velumn" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ThreadIndex,
})

function ThreadIndex() {
  return (
    <main className="forum-shell thread-state">
      <h1>Choose a discussion</h1>
      <p>Open a discussion from a public server or channel page.</p>
      <a className="thread-link" href="/">
        Return to Velumn
      </a>
    </main>
  )
}
