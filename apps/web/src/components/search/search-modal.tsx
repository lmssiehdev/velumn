/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: sanitized on the server :) */
"use client";

import {
	CaretRightIcon,
	ChatTeardropIcon,
	MagnifyingGlassIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { TRPCClient } from "@trpc/client";
import { useDebounce } from "@uidotdev/usehooks";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { ThreadIcon } from "@/components/markdown/mention";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { botClient } from "@/utils/trpc-client";
import type { BotRouter } from "../../../../bot/src/helpers/trpc";

export default function SearchModal({
	open,
	toggleOpen,
	serverId,
}: {
	open: boolean;
	toggleOpen: React.Dispatch<React.SetStateAction<boolean>>;
	serverId: string;
}) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<
		Awaited<ReturnType<TRPCClient<BotRouter>["search"]["query"]>>["hits"]
	>([]);
	const debouncedQuery = useDebounce(query, 150);

	useEffect(() => {
		if (!debouncedQuery) {
			setResults([]);
			return;
		}

		const abortController = new AbortController();

		const searchMessages = async () => {
			try {
				const data = await botClient.search.query(
					{
						serverId,
						query: debouncedQuery,
					},
					{
						signal: abortController.signal,
					},
				);

				if (!abortController.signal.aborted) {
					setResults(data.hits);
				}
			} catch (error) {
				if (!abortController.signal.aborted) {
					console.error("Search failed:", error);
				}
			}
		};

		searchMessages();

		return () => {
			abortController.abort();
		};
	}, [debouncedQuery, serverId]);
	return (
		<CommandDialog
			open={open}
			onOpenChange={toggleOpen}
			className="max-w-3xl! w-full top-[35%]!"
			showCloseButton={false}
		>
			<div
				data-slot="command-input-wrapper"
				className="flex h-9 items-center gap-2 border-b px-3"
			>
				<MagnifyingGlassIcon
					className="size-5 shrink-0 opacity-50"
					weight="bold"
				/>
				<input
					autoComplete="off"
					name="search"
					data-slot="command-input"
					className={
						"placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50 outline-none ring-0 border-0"
					}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search community..."
				/>
				<button
					className="bg-muted text-muted-foreground pointer-events-none inline-flex items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none"
					onClick={() => toggleOpen(false)}
				>
					<span className="text-sm">ESC</span>
				</button>
			</div>
			<CommandList>
				<CommandEmpty>
					{debouncedQuery.length === 0 ? (
						<div className="py-4 text-center">
							<MagnifyingGlassIcon className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
							<p className="text-muted-foreground text-sm">
								Start typing to search the community
							</p>
						</div>
					) : (
						<div>
							<p className="mb-1 text-lg font-medium">No results found</p>
							<p className="text-sm text-muted-foreground max-w-xs mx-auto">
								We couldn’t find anything for{" "}
								<span className="font-medium text-foreground">
									“{debouncedQuery}”
								</span>
							</p>
							<p className="mt-3 text-xs text-muted-foreground">
								Try different keywords or remove filters
							</p>
						</div>
					)}
				</CommandEmpty>
				{results?.length !== 0 && (
					<>
						<div className="text-neutral-700 px-2 pt-2 pb-1 text-sm">
							Result
						</div>
						<CommandGroup className="p-0!">
							{results?.map((hit) => {
								const { content, title, channelName, threadUrl } = hit;
								const contentExist = content !== "";
								return (
									<Link
										onClick={() => {
											toggleOpen(false);
										}}
										key={hit.id}
										href={threadUrl ?? "#"}
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
														dangerouslySetInnerHTML={{ __html: channelName! }}
													/>
													{contentExist && (
														<>
															<CaretRightIcon className="inline-block size-3! shrink-0" />
															<span
																className="truncate"
																dangerouslySetInnerHTML={{ __html: title! }}
															/>
														</>
													)}
												</div>

												{contentExist ? (
													<div className="text-sm leading-relaxed line-clamp-2 ">
														<span
															dangerouslySetInnerHTML={{ __html: content! }}
														/>
													</div>
												) : (
													<div className="leading-relaxed line-clamp-2 ">
														<span
															dangerouslySetInnerHTML={{ __html: title! }}
														/>
													</div>
												)}
											</div>
											<div className="w-5 flex justify-end shrink-0">
												<CaretRightIcon className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
											</div>
										</CommandItem>
									</Link>
								);
							})}
						</CommandGroup>
					</>
				)}
			</CommandList>
		</CommandDialog>
	);
}
