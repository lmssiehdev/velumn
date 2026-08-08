import {
	ChatIcon,
	ChatsCircleIcon,
	HashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getServerInfo } from "@repo/db/helpers/servers";
import { constructDiscordLink } from "@repo/utils/helpers/discord";
import { getEmbedFileInfo } from "@repo/utils/helpers/misc";
import {
	getSlugFromTitle,
	slugifyThreadUrl,
} from "@repo/utils/helpers/slugify";
import { getDateFromSnowflake } from "@repo/utils/helpers/snowflake";
import { snowflakeToReadableDate } from "@repo/utils/helpers/time";
import { ChannelType } from "discord-api-types/v10";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { JsonLd } from "react-schemaorg";
import type { DiscussionForumPosting, WithContext } from "schema-dts";
import { ContinueDiscussion } from "@/components/forum/continue-discussion";
import { ServerInfo } from "@/components/forum/shell";
import { anonymizeName, MessagePost } from "@/components/forum/thread-message";
import { HashProvider } from "@/components/forum/thread-message-highlight";
import type { ThreadMessagesWithMetadata } from "@/components/forum/thread-types";
import { ThreadIcon } from "@/components/markdown/mention";
import ThreadFeedback from "@/components/thread-feedback";
import {
	getCustomDomainUrl,
	getMainSiteUrl,
	getThreadPath,
	hasVerifiedCustomDomain,
} from "@/lib/domains";
import { buildDiscussionMetadata, buildRobots, toDescription } from "@/lib/seo";
import { ThreadProvider } from "@/providers/use-thread";
import { getAllMessagesInThreadsCache } from "@/utils/cache";
import { sanitizeJsonLd } from "@/utils/sanitize";

type PageProps = {
	params: Promise<{ threadId: string; slug: string }>;
};

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { threadId, slug } = await params;

	const thread = await getAllMessagesInThreadsCache(threadId);

	if (
		!thread?.messages ||
		thread.messages.length === 0 ||
		!thread.channelName
	) {
		return {
			title: "Thread not found",
			robots: {
				index: false,
				follow: false,
			},
		};
	}

	const url = slugifyThreadUrl({ id: threadId, name: thread.channelName! });
	const canonicalUrl = getMainSiteUrl(url);
	const hasSlug = slug === getSlugFromTitle(thread.channelName!);

	return buildDiscussionMetadata({
		title: thread.channelName,
		description:
			toDescription(thread.messages[0]?.cleanContent, 160) ??
			`Read the indexed Discord discussion for ${thread.channelName}.`,
		canonicalUrl,
		image: {
			url: new URL(`/og?id=${threadId}`, canonicalUrl).toString(),
			alt: `${thread.channelName} discussion preview`,
		},
		robots: buildRobots({
			index: Boolean(hasSlug),
			follow: true,
		}),
	});
}

export default async function Page({ params }: PageProps) {
	const { threadId, slug } = await params;

	if (!threadId) {
		notFound();
	}

	const thread = await getAllMessagesInThreadsCache(threadId);

	if (!thread?.server) {
		notFound();
	}

	const routingServer = await getServerInfo(thread.serverId);
	if (hasVerifiedCustomDomain(routingServer)) {
		const targetPath = getThreadPath(threadId, thread.channelName!);
		permanentRedirect(getCustomDomainUrl(routingServer, targetPath));
	}

	const threadUrlWithSlug = slugifyThreadUrl({
		id: threadId,
		name: thread.channelName!,
	});
	if (slug !== getSlugFromTitle(thread.channelName!)) {
		redirect(threadUrlWithSlug);
	}

	const server = thread.server;

	const [originalPost, ...orderedMessages] = thread.messages;

	const items = [
		...orderedMessages.map((msg) => ({ type: "message" as const, data: msg })),
		...thread.backlinks.map((backlink) => ({
			type: "backlink" as const,
			data: {
				id: backlink.fromMessageId,
				...backlink,
			},
		})),
	].sort((a, b) => a.data.id.localeCompare(b.data.id));

	if (!originalPost) {
		notFound();
	}

	const op = originalPost.user!;
	const title = thread.channelName ?? originalPost.content?.slice(0, 100);
	const firstImage = originalPost.attachments
		.filter((a) => getEmbedFileInfo(a).type === "image")
		.at(0);

	const authorId = thread.messages[0]?.user?.id;
	const dateModified = thread.messages
		.map((m) => m.id)
		.reduce((snowflake, snowflake2) =>
			BigInt(snowflake) > BigInt(snowflake2) ? snowflake : snowflake2,
		);

	const messagesLookup = new Map<string, ThreadMessagesWithMetadata>(
		thread.messages.map((x) => [x.id, x]),
	);
	const canonicalUrl = getMainSiteUrl(threadUrlWithSlug);

	return (
		<div>
			<ThreadProvider thread={thread}>
				<JsonLd<DiscussionForumPosting>
					item={sanitizeJsonLd<WithContext<DiscussionForumPosting>>({
						"@context": "https://schema.org",
						"@type": "DiscussionForumPosting",
						url: canonicalUrl,
						datePublished: getDateFromSnowflake(thread.id).toISOString(),
						dateModified: getDateFromSnowflake(dateModified).toISOString(),
						author: {
							"@type": "Person",
							name: anonymizeName(op),
							url: undefined,
							identifier: op.anonymizeName ? anonymizeName(op) : op?.id,
						},
						image:
							firstImage?.proxyURL ||
							new URL(`/og?id=${thread.id}`, canonicalUrl).toString(),
						headline: title,
						articleBody: originalPost.content,
						identifier: thread.id,
						commentCount: orderedMessages.length,
						comment: orderedMessages.map((m, idx) => ({
							"@type": "Comment",
							text: m.content,
							identifier: m.id,
							datePublished: getDateFromSnowflake(m.id).toISOString(),
							position: idx + 1,
							author: {
								"@type": "Person",
								name: anonymizeName(m.user!),
								url: undefined,
								identifier: m.user?.anonymizeName
									? anonymizeName(m.user!)
									: m.user?.id,
							},
						})),
					})}
				/>
				<div>
					<div className="my-6 px-3">
						<h1 className="my-2 max-w-4xl text-balance truncate font-medium text-3xl tracking-tight lg:text-4xl">
							{thread.channelName}
						</h1>
						<Link
							className="flex w-fit items-center gap-1 bg-purple-100 px-2 py-0.5 text-purple-700 text-sm transition-all hover:bg-purple-200 "
							href={`/channel/${thread.parentId}`}
						>
							{thread.parent?.type === ChannelType.GuildForum ? (
								<ChatsCircleIcon className="size-3.5" />
							) : (
								<HashIcon className="size-3.5" weight="bold" />
							)}
							{thread.parent?.channelName}
						</Link>
					</div>
				</div>
				<HashProvider>
					<div className="flex flex-col gap-6 overflow-hidden md:flex-row">
						<div className="flex-1 overflow-hidden">
							{originalPost !== undefined && (
								<MessagePost
									authorId={authorId!}
									isOriginalPost={true}
									key={originalPost?.id}
									message={originalPost!}
								/>
							)}
							<div className="my-4 flex items-center gap-2 px-3">
								<ChatIcon className="size-5" />
								<span className="text-sm">
									{orderedMessages.length} Replies
								</span>
							</div>
							<div className="space-y-2">
								{items.map((item) => {
									if (item.type === "message") {
										return (
											<MessagePost
												authorId={authorId!}
												key={item.data.id}
												message={item.data}
												referenceMessage={messagesLookup.get(
													item.data.referenceId!,
												)}
											/>
										);
									}
									return (
										<div className="relative flex gap-3 p-4" key={item.data.id}>
											<div className="-my-2 absolute top-0 bottom-0 left-7.5 w-0.5 bg-neutral-200" />

											<div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-neutral-200">
												<ThreadIcon className="size-4 text-neutral-700" />
											</div>
											<div className="min-w-0 flex-1">
												<div className="text-neutral-600 text-sm">
													<span className="font-semibold text-neutral-700">
														@
														{item.data.fromThread?.author
															? anonymizeName(item.data.fromThread.author)
															: "Unknown"}
													</span>{" "}
													mentioned this thread{" "}
													<span className="text-neutral-400">•</span>{" "}
													<span className="text-neutral-500 text-xs">
														{snowflakeToReadableDate(item.data.fromMessageId)}
													</span>
												</div>
												<a
													className="mt-1 inline-block font-medium text-neutral-900 underline underline-offset-2 transition-colors"
													href={
														item.data.fromThread?.channelName
															? `${slugifyThreadUrl({
																	id: item.data.fromThreadId,
																	name: item.data.fromThread.channelName,
																})}#${item.data.fromMessageId}`
															: `/thread/${item.data.fromThreadId}#${item.data.fromMessageId}`
													}
												>
													{item.data.fromThread?.channelName}
												</a>
											</div>
										</div>
									);
								})}
							</div>
							<ContinueDiscussion
								noReplies={orderedMessages.length === 0}
								url={constructDiscordLink({
									serverId: server.id,
									threadId: thread.id,
								})}
							/>
						</div>
						<div className="hidden w-full max-w-xs space-y-6 md:block">
							<ServerInfo homeHref={`/server/${server.id}`} server={server} />
							<ThreadFeedback />
						</div>
					</div>
				</HashProvider>
			</ThreadProvider>
		</div>
	);
}
