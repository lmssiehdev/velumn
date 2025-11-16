/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: sanitized */
"use client";

import {
	CaretRightIcon,
	ChatTeardropIcon,
	MagnifyingGlassIcon,
} from "@phosphor-icons/react/dist/ssr";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThreadIcon } from "@/components/markdown/mention";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { slugifyThreadUrl } from "@/lib/slugify";
import type { BotRouter } from "../../../../../../../bot/src/helpers/trpc";

const botClient = createTRPCClient<BotRouter>({
	links: [
		httpBatchLink({
			url: `${process.env.NEXT_PUBLIC_BOT_API_URL}/trpc`,
		}),
	],
});

if (!process.env.NEXT_PUBLIC_BOT_API_URL) {
	throw new Error("NEXT_PUBLIC_BOT_API_URL is not set");
}

export function CommandDialogDemo({ hits }: { hits: any[] }) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<any[]>([]);
	const debouncedQuery = useDebounce(query, 300);
	const router = useRouter();

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	useEffect(() => {
		if (!query) {
			setResults([]);
			return;
		}
		// TODO: use debounce; and cancel loading;
		const searchMessages = async () => {
			try {
				const data = await botClient.search.query({
					serverId: "1228579842212106302",
					query: query,
					limit: 10,
				});
				setResults(data.hits);
			} catch (error) {
				console.error("Search failed:", error);
			}
		};

		searchMessages();
	}, [query]);

	return (
		<div className="mx-2">
			<p className="text-muted-foreground text-sm">
				Press{" "}
				<kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
					<span className="text-xs">⌘</span>K
				</kbd>
			</p>
			<CommandDialog
				open={open}
				onOpenChange={setOpen}
				className="max-w-3xl! w-full top-[35%]!"
			>
				<div
					data-slot="command-input-wrapper"
					className="flex h-9 items-center gap-2 border-b px-3"
				>
					<MagnifyingGlassIcon className="size-4 shrink-0 opacity-50" />
					<input
						data-slot="command-input"
						className={
							"placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50 outline-none ring-0 border-0"
						}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search messages..."
					/>
				</div>
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					{results?.length !== 0 && (
						<CommandGroup heading="Result" className="p-0!">
							{results?.map((hit) => {
								const {
									threadId,
									content,
									title,
									channelName,
									isThreadStarter,
									id,
								} = hit;
								const threadUrl =
									slugifyThreadUrl({
										id: threadId,
										name: title,
									}) + (isThreadStarter ? "" : `/#${id}`);

								return (
									<Link
										key={hit.id}
										href={threadUrl}
										prefetch={false}
										className="block mx-2 my-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md [&_mark]:bg-primary/10 [&_mark]:text-purple-500 [&_mark]:font-semibold [&_mark]:px-0.5 [&_mark]:rounded"
									>
										<CommandItem className="border w-full group hover:bg-accent  cursor-pointer">
											{hit.isThreadStarter ? (
												<ThreadIcon className="size-4 shrink-0 self-start" />
											) : (
												<ChatTeardropIcon
													className="size-4 shrink-0 self-start"
													weight="duotone"
												/>
											)}
											<div className="flex-1 min-w-0 flex flex-col gap-1.5">
												<div className="space-x-0.5 text-xs text-muted-foreground">
													<span
														className="truncate"
														dangerouslySetInnerHTML={{ __html: channelName }}
													/>
													<CaretRightIcon className="inline-block size-3! shrink-0" />
													<span
														className="truncate"
														dangerouslySetInnerHTML={{ __html: title }}
													/>
												</div>

												<div className="text-sm leading-relaxed line-clamp-2 ">
													<span dangerouslySetInnerHTML={{ __html: content }} />
												</div>
											</div>
											<div className="w-5 flex justify-end shrink-0">
												<CaretRightIcon className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
											</div>
										</CommandItem>
									</Link>
								);
							})}
						</CommandGroup>
					)}
				</CommandList>
			</CommandDialog>
		</div>
	);
}

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}
