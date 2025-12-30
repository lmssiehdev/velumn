"use client";

import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { DBAttachments } from "@repo/db/helpers/validation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { memo, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getLanguageFromFileName, highlightCode } from "@/utils/shiki";
import { DynamicQueryProvider } from "./dynamic-react-query-provider";

export function CodeViewer({ attachments }: { attachments: DBAttachments[] }) {
	if (!attachments.length) {
		return null;
	}
	return (
		<DynamicQueryProvider>
			{attachments.map((attachment) => (
				<LazyCodeViewer key={attachment.id} attachment={attachment} />
			))}
		</DynamicQueryProvider>
	);
}
const CodeLoadingSkeleton = memo(() => {
	return (
		<div className="w-full rounded-lg border p-4 space-y-2">
			{[...Array(3)].map((_, i) => (
				<div
					key={i}
					className="h-3 bg-gray-200 animate-pulse"
					style={{ width: `${Math.random() * 40 + 50}%` }}
				/>
			))}
		</div>
	);
});

function LazyCodeViewer({ attachment }: { attachment: DBAttachments }) {
	const [shouldLoad, setShouldLoad] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setShouldLoad(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "200px" },
		);

		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref}>
			{shouldLoad ? (
				<Suspense fallback={<CodeLoadingSkeleton />}>
					<CodeViewerInner attachment={attachment} />
				</Suspense>
			) : (
				<CodeLoadingSkeleton />
			)}
		</div>
	);
}

const CodeViewerInner = ({ attachment }: { attachment: DBAttachments }) => {
	const { name: fileName, proxyURL: fileUrl } = attachment;
	const [isExpanded, setIsExpanded] = useState(false);
	const detectedLanguage = getLanguageFromFileName(fileName);

	const { data: code } = useSuspenseQuery({
		queryKey: ["preview-code", fileUrl],
		queryFn: async () => {
			try {
				const response = await fetch(fileUrl, {
					headers: { Range: "bytes=0-40000" },
				});
				if (!response.ok) {
					throw new Error("Failed to fetch code");
				}
				const content = await response.text();
				return await highlightCode(content, detectedLanguage);
			} catch (_err) {
				return `<pre>Failed to fetch code.</pre>`;
			}
		},
		staleTime: Infinity,
	});

	const handleDownload = () => {
		if (!code) return;

		window.open(fileUrl, "_blank");
	};

	const lines = code?.split("\n") || [];
	const MAX_PREVIEW_LINES = 10;
	const shouldTruncate = lines.length > MAX_PREVIEW_LINES;

	const previewCode = shouldTruncate
		? lines.slice(0, MAX_PREVIEW_LINES).join("\n")
		: code || "";

	function HighlightedCode({
		code,
		className,
	}: {
		code: string;
		className?: string;
	}) {
		return (
			<div
				className={cn(
					"max-w-full text-sm! [&_pre]:max-w-0 [&_code]:whitespace-pre",
					className,
				)}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: required for code highlighting
				dangerouslySetInnerHTML={{
					__html: code,
				}}
			/>
		);
	}

	function DownloadButton() {
		return (
			<Button
				variant="ghost"
				size="sm"
				className="h-7 text-xs shrink-0"
				onClick={handleDownload}
			>
				<Download className="size-4" />
			</Button>
		);
	}
	return (
		<div className="w-full rounded-md border flex flex-col [&_pre]:!bg-transparent">
			<div className="text-sm w-full min-w-0 ">
				<HighlightedCode code={previewCode} className="overflow-auto" />
				{shouldTruncate && (
					<div className=" px-2 py-0.5 text-sm text-muted-foreground italic">
						... {lines.length - MAX_PREVIEW_LINES} more lines
					</div>
				)}
			</div>

			<div className="flex items-center justify-between px-3 py-2 border-t shrink-0 ">
				<div className="flex gap-1.5 items-center justify-center">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 shrink-0"
						onClick={() => setIsExpanded(true)}
					>
						<ArrowsOutSimpleIcon className="size-4" />
					</Button>
					<span className="leading-normal ">Expand</span>
				</div>
				<div className="flex items-center justify-center gap-1.5">
					<span className="text-sm font-medium truncate text-neutral-700">
						{fileName}
					</span>
					<DownloadButton />
				</div>
			</div>

			<Dialog open={isExpanded} onOpenChange={setIsExpanded}>
				<DialogContent
					showCloseButton={false}
					className="max-w-[80vw]! w-full h-[80vh] flex flex-col gap-0 p-1"
				>
					<div className="flex-1 min-h-0 overflow-auto">
						<HighlightedCode code={code} />
					</div>

					<div className="ml-auto">
						<div className="flex items-center justify-center gap-1.5">
							<DialogTitle>
								<span className="text-sm font-medium truncate text-neutral-700">
									{fileName}
								</span>
							</DialogTitle>
							<DownloadButton />
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
};
