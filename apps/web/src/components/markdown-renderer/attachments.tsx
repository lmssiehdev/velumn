import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ArrowUpRightIcon,
    File
} from "@phosphor-icons/react/dist/ssr";
import type { DBAttachments } from "@repo/db/schema";
// @ts-expect-error no types - used once;
import bytes from "bytes";

export function Attachments({ attachments }: { attachments: DBAttachments[] }) {
    if ( !attachments.length ) return null;
    const isImage = (a: DBAttachments) => a.contentType?.startsWith('image/') && !a.proxyUrl.endsWith(".svg");
    const isCode = (a: DBAttachments) => !a.contentType?.startsWith('image/') || a.proxyUrl.endsWith(".svg")

    return <div className="flex flex-col gap-2">
        <ImageGallery images={attachments.filter(isImage)} />
        {
            attachments.filter(isCode).map(
                (attachment) => <FileShowcase key={attachment.id} attachment={attachment} />
            )
        }
        </div>
}

 function FileShowcase({ attachment }: { attachment: DBAttachments }) {
    const { name, size } = attachment;

    return (
        <div
            className="group flex gap-2.5 border border-neutral-300 p-4 shadow-[0_1px_4px_0_hsl(0_0%_0%_/_0.08)] max-w-md w-full mt-2 relative"
        >
            <div className="flex items-center justify-center">
                <File weight="thin" className="size-10" />
            </div>
            <div className="flex flex-col overflow-hidden">
                <Link
                    href="#"
                    className="hover:underline underline-offset-2 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                    {name}
                </Link>
                <span className="text-sm text-neutral-500">
                    {bytes(size, 2)}{" "}
                </span>
            </div>
            <div
                className="absolute top-0 right-0 translate-x-[50%] translate-y-[-50%]
                                               opacity-0 group-hover:opacity-100
                                               group-hover:animate-in group-hover:fade-in-0 group-hover:zoom-in-95
                                               transition-opacity duration-300"
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={"outline"}
                            size={"icon"}
                            className="cursor-pointer"
                        >
                            <ArrowUpRightIcon
                                className="size-6"
                                weight={"bold"}
                            />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Open in discord</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    )
}

// for quick testing
const MAX_IMAGES = 2;
const _dummyImages = Array.from({ length: 10 }, () => ({
    id: Math.random(),
    name: "test.png",
    proxyUrl: "https://discord-indexer.s3.us-east-1.amazonaws.com/1417376726077407343/troy-olson-O5UG81P7yzE-unsplash.jpg",
})).splice(0, MAX_IMAGES);

function ImageGallery({ images }: { images: DBAttachments[] }) {
    if (!images.length) {
        return null;
    }

    // TODO: discord heights
    const styles: Record<number, string> = {
        1: "grid gap-1s",
        2: "grid gap-1 grid-cols-2  ",
        3: "grid gap-1 grid-cols-2 grid-rows-2  [&>*:first-child]:row-span-2",
        4: "grid gap-1 grid-cols-2 grid-rows-2 ",
        5: "grid gap-1 grid-cols-6 grid-rows-2 [&>*:nth-child(-n+2)]:col-span-3 [&>*:nth-child(n+3)]:col-span-2",
        6: "grid gap-1 grid-cols-3 grid-rows-2 *:h-[181px]",
        7: "grid gap-1 grid-cols-3 grid-rows-3 *:h-[181px] [&>*:first-child]:col-span-3",
        8: "grid gap-1 grid-cols-6 grid-rows-3 *:h-[181px] [&>*:nth-child(n+3)]:col-span-2 [&>*:nth-child(-n+2)]:col-span-3",
        9: "grid gap-1 grid-cols-3 grid-rows-3 *:h-[181px]",
        10: "grid gap-1 grid-cols-3 grid-rows-4 *:h-[181px] [&>*:first-child]:col-span-3",
    }

    return <div className={
        cn("max-w-[550px] w-full rounded overflow-hidden py-0.5", styles[images.length])
    }>
        {
            images.map(({ id, proxyUrl, name }) => {
                return <img className="rounded inline-block min-h-full min-w-full object-cover"
                    src={proxyUrl}
                    alt={name}
                    key={id} />
            }
            )
        }
    </div>
}