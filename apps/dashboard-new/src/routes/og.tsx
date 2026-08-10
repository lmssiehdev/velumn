import { createFileRoute } from "@tanstack/react-router"
import ImageResponse from "takumi-js/response"

import { VelumnMark } from "@/components/velumn-mark"
import { loadPublicThreadOgSummary } from "@/features/public-thread/server"
import questrialDataUrl from "../assets/Questrial-Regular.ttf?inline"

const questrialFont = Buffer.from(
  questrialDataUrl.split(",")[1] ?? "",
  "base64"
)

export const Route = createFileRoute("/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const threadId = new URL(request.url).searchParams.get("id")
        if (!threadId || !/^[0-9]{1,20}$/.test(threadId)) {
          return new Response("Invalid thread ID", { status: 400 })
        }

        const thread = await loadPublicThreadOgSummary(threadId)
        if (!thread) return new Response("Thread not found", { status: 404 })

        const titleFontSize =
          thread.title.length > 90 ? 54 : thread.title.length > 60 ? 62 : 76

        return new ImageResponse(
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "56px 64px 48px",
              background: "#f7f5ed",
              color: "#191918",
              fontFamily: "Questrial",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#67665f",
                fontSize: 30,
              }}
            >
              {thread.server.name}
            </div>

            <div
              style={{
                display: "flex",
                maxHeight: "240px",
                overflow: "hidden",
                marginTop: "28px",
                fontSize: titleFontSize,
                fontWeight: 400,
                letterSpacing: `-${titleFontSize * 0.045}px`,
                lineHeight: 1.01,
              }}
            >
              {thread.title}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginTop: "24px",
                color: "#67665f",
                fontSize: 26,
              }}
            >
              <span style={{ color: "#5145a7" }}>
                {thread.replyCount}{" "}
                {thread.replyCount === 1 ? "reply" : "replies"}
              </span>
              <span style={{ color: "#a09e95" }}>·</span>
              <span>#{thread.parent.name}</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-end",
                gap: "10px",
                marginTop: "auto",
                fontSize: 28,
              }}
            >
              <VelumnMark size={28} />
              Velumn
            </div>
          </div>,
          {
            width: 1200,
            height: 630,
            fonts: [questrialFont],
            headers: {
              "Cache-Control": "no-store",
            },
          }
        )
      },
    },
  },
})
