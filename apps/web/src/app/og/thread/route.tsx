import { getAllMessagesInThreadsCache, getServerInfoByChannelIdCache } from "@/utils/cache";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "About Velumn";
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

    // TODO: handle non existing threads;
    const questrial = await readFile(join(process.cwd(), "assets/Questrial-Regular.ttf"));
    return new ImageResponse(
        (
            <div
                style={{
                    background: "white",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    padding: "60px 40px 0 50px",
                    flexDirection: "column",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        fontSize: 44,
                        display: "flex",
                        color: "#404040",
                    }}
                >
                    c/{server?.name}
                </div>
                <div
                    style={{
                        display: "flex",
                        fontSize: 77,
                        fontWeight: "bold",
                        marginTop: 20,
                    }}
                >
                    {thread?.channelName}
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#404040",
                        marginTop: 20,
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
                            marginLeft: "20px",
                            marginRight: "20px",
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
                <div
                    style={{
                        fontSize: 33,
                        position: "absolute",
                        display: "flex",
                        bottom: "5%",
                        right: "3%",
                    }}
                >
                    <LogoIcon size={33} />
                    Velumn
                </div>
            </div>
        ),
        {
            ...size,
            fonts: [
                {
                    name: "Inter",
                    data: questrial,
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
            d="M216 48H40a16 16 0 0 0-16 16v160a15.84 15.84 0 0 0 9.25 14.5A16.05 16.05 0 0 0 40 240a15.9 15.9 0 0 0 10.25-3.78l.09-.07L83 208h133a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16m0 144H80a8 8 0 0 0-5.23 1.95L40 224V64h176Z"
        ></path>
    </svg>
);

const LogoIcon = ({ size }: { size: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        width={size}
        height={size}
        style={{
            color: "#404040",
            marginRight: "8px",
        }}
    >
        <path d="M169.57 72.59A80 80 0 0 0 16 104v64a16 16 0 0 0 16 16h54.67A80.15 80.15 0 0 0 160 232h64a16 16 0 0 0 16-16v-64a80 80 0 0 0-70.43-79.41M32 104a64 64 0 1 1 64 64H32Zm192 112h-64a64.14 64.14 0 0 1-55.68-32.43 79.93 79.93 0 0 0 70.38-93.86A64 64 0 0 1 224 152Z"></path>
    </svg>
);
