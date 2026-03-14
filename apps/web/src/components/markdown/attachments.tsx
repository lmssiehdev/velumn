import { ArrowUpRightIcon, FileIcon } from "@phosphor-icons/react/dist/ssr";
import type { DBAttachments } from "@repo/db/helpers/validation";
import { constructDiscordLink } from "@repo/utils/helpers/discord";
import { getEmbedFileInfo } from "@repo/utils/helpers/misc";
// @ts-expect-error no types - used once;
import bytes from "bytes";
import { buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CodeViewer } from "../code-preview";

type AttachmentsProp = {
	metadata: {
		serverId: string;
		channelId: string;
	};
	attachments: DBAttachments[];
};

export function Attachments({ attachments, metadata }: AttachmentsProp) {
	if (!attachments?.length) {
		return null;
	}

	const nonEmbeddableAttachments = attachments.filter(
		(a) => !getEmbedFileInfo(a).isEmbeddable,
	);
	const embeddableAttachments = attachments.filter(
		(a) => getEmbedFileInfo(a).isEmbeddable,
	);

	const codeAttachments = embeddableAttachments.filter(
		(a) => getEmbedFileInfo(a).type === "code",
	);

	const imageAttachments = embeddableAttachments.filter(
		(a) => getEmbedFileInfo(a).type === "image",
	);

	return (
		<div className="flex flex-col gap-2">
			{imageAttachments.length > 0 && (
				<ImageGallery images={imageAttachments} />
			)}
			{codeAttachments.length > 0 && (
				<div className="space-y-2">
					<CodeViewer attachments={codeAttachments} />
				</div>
			)}
			{nonEmbeddableAttachments.length > 0 && (
				<FileShowcase
					attachments={nonEmbeddableAttachments}
					metadata={metadata}
				/>
			)}
		</div>
	);
}

function FileShowcase({ attachments, metadata }: AttachmentsProp) {
	return (
		<>
			{attachments.map((a) => {
				const { name, size, messageId } = a;
				const attachmentMessageUrl = constructDiscordLink({
					serverId: metadata.serverId,
					threadId: metadata.channelId,
					messageId,
				});
				return (
					<div
						key={a.id}
						className="group relative mt-2 flex w-full max-w-md gap-2.5 border border-neutral-300 p-4 shadow"
					>
						<div className="flex items-center justify-center">
							<FileIcon className="size-10" weight="thin" />
						</div>
						<div className="flex flex-col overflow-hidden">
							<a
								className="overflow-hidden text-ellipsis whitespace-nowrap underline-offset-2 hover:underline"
								href={attachmentMessageUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								{name}
							</a>
							<span className="text-neutral-500 text-sm">
								{bytes(size, 2)}{" "}
							</span>
						</div>
						<div className="group-hover:fade-in-0 group-hover:zoom-in-95 absolute top-0 right-0 translate-x-[50%] translate-y-[-50%] opacity-0 transition-opacity duration-300 group-hover:animate-in group-hover:opacity-100">
							<Tooltip>
								<TooltipTrigger asChild>
									<a
										className={buttonVariants({
											size: "icon",
											variant: "outline",
										})}
										href={attachmentMessageUrl}
										target="_blank"
									>
										<ArrowUpRightIcon className="size-6" weight={"bold"} />
									</a>
								</TooltipTrigger>
								<TooltipContent>
									<p>Open in discord</p>
								</TooltipContent>
							</Tooltip>
						</div>
					</div>
				);
			})}
		</>
	);
}

// for quick testing
const MAX_IMAGES = 2;
const _dummyImages = Array.from({ length: 10 }, () => ({
	id: Math.random(),
	name: "test.png",
	proxyURL:
		"https://discord-indexer.s3.us-east-1.amazonaws.com/1417376726077407343/troy-olson-O5UG81P7yzE-unsplash.jpg",
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
	};
	return (
		<div
			className={cn(
				"w-full max-w-[550px] overflow-hidden rounded py-0.5",
				styles[images.length],
			)}
		>
			{images.map(({ id, proxyURL, name, description, height, width }) => (
				<img
					alt={description || name}
					className="inline-block min-h-full min-w-full rounded object-cover"
					height={height ?? undefined}
					key={id}
					loading="lazy"
					src={proxyURL}
					width={width ?? undefined}
				/>
			))}
		</div>
	);
}
