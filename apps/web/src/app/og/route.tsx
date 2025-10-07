import { getAllMessagesInThreadsCache, getServerInfoByChannelIdCache } from "@/utils/cache";
import { ChatIcon } from "@phosphor-icons/react/dist/ssr";
import { NextApiRequest } from "next";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const runtime = "edge";

// Image metadata
export const alt = "About Acme";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// Image generation
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const threadId = searchParams.get("id")!;
  const [thread, server] = await Promise.all([
    await getAllMessagesInThreadsCache(threadId),
    await getServerInfoByChannelIdCache(threadId),
  ]);

  // TODO: trim title;
  // TODO: handle non existing threads;
  //
  // Font loading, process.cwd() is Next.js project directory
  console.log("cwd", process.cwd());
  const satoshi = await readFile(join(process.cwd(), "assets/Questrial-Regular.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          background: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "90px",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: 33,
            display: "flex",
          }}
        >
          c/{server?.name}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 89,
            fontWeight: "bold",
            marginTop: 22,
          }}
        >
          {thread?.channelName}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "22px",
            color: "#404040",
            marginTop: 22,
          }}
        >
          <CommentIcon size={44} />
          <div
            style={{
              display: "flex",
              fontSize: 44,
            }}
          >
            {thread?.messages.length ?? 0 - 1} Replies
          </div>

          <div
            style={{
              fontSize: 55,
              display: "flex",
            }}
          >
            •
          </div>
          <div
            style={{
              fontSize: 44,
              display: "flex",
            }}
          >
            in #reports
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: satoshi,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}

const CommentIcon = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    width={size}
    height={size}
    style={{
      color: "#404040",
    }}
  >
    <path
      fill="currentColor"
      d="M232.07 186.76a80 80 0 0 0-62.5-114.17 80 80 0 1 0-145.64 66.17l-7.27 24.71a16 16 0 0 0 19.87 19.87l24.71-7.27a80.4 80.4 0 0 0 25.18 7.35 80 80 0 0 0 108.34 40.65l24.71 7.27a16 16 0 0 0 19.87-19.86ZM62 159.5a8.3 8.3 0 0 0-2.26.32L32 168l8.17-27.76a8 8 0 0 0-.63-6A64 64 0 1 1 65.8 160.5a8 8 0 0 0-3.8-1m153.79 28.73L224 216l-27.76-8.17a8 8 0 0 0-6 .63 64.05 64.05 0 0 1-85.87-24.88 79.93 79.93 0 0 0 70.33-93.87 64 64 0 0 1 41.75 92.48 8 8 0 0 0-.63 6.04Z"
    ></path>
  </svg>
);
