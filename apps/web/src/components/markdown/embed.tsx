import type { DBMessage } from "@repo/db/schema/discord";
import { dayjs } from "@repo/utils/helpers/dayjs";
import { parse } from "discord-markdown-parser";
import { cn } from "@/lib/utils";
import { CustomEmoji, Twemoji } from "./emoji";
import { DiscorMarkdownList, type SingleASTNode } from "./renderer";
import { Spoiler } from "./spoiler";

type DBEmbed = NonNullable<DBMessage["embeds"]>[number];

export function Embeds({ embeds }: { embeds: DBEmbed[] | null }) {
	if (!embeds?.length) {
		return null;
	}
	return (
		<>
			{embeds.map((embed, idx) => {
				const isLinkEmbed = embed.type === "article" || embed.type === "link";
				const hasSmallThumbnail =
					embed.thumbnail && !isLinkEmbed && embed.type !== "image";

				const borderLeftColor = embed.color
					? `#${embed.color.toString(16).padStart(6, "0")}`
					: "dadadc";
				if (embed.type === "gifv") {
					const { height, width } = embed.video!;
					return (
						<div className="mt-4 overflow-hidden rounded" key={idx}>
							<video
								autoPlay
								loop
								muted
								poster={embed.thumbnail?.url}
								src={embed.video?.url}
								style={getScaledDownWidth({
									width,
									height,
								})}
							/>
						</div>
					);
				}
				if (embed.type === "image") {
					const { height, width } = embed.image! ?? embed.thumbnail!;
					return (
						<div className="mt-4 overflow-hidden rounded" key={idx}>
							<img
								src={embed.url}
								style={getScaledDownWidth({
									width,
									height,
								})}
							/>
						</div>
					);
				}

				const hasLargeThumbnail = embed.thumbnail && isLinkEmbed;

				const inlineCount = embed?.fields?.filter((f) => f.inline).length ?? 0;
				const gridCols =
					inlineCount >= 3
						? "grid-cols-3"
						: inlineCount === 2
							? "grid-cols-2"
							: "grid-cols-1";
				return (
					<div
						className="grid w-md rounded-md border border-l-4 px-4 pt-2 pb-3 shadow-xs"
						key={idx}
						style={{
							borderLeftColor,
							gridTemplateColumns: hasSmallThumbnail ? "1fr auto" : "1fr",
						}}
					>
						<div className="min-w-0">
							{embed.provider && (
								<div
									className="text-neutral-600 text-xs mb-0.5"
									style={{
										gridColumn: hasSmallThumbnail ? "1 / -1" : "1",
									}}
								>
									{embed.provider.name}
								</div>
							)}
							{embed.author && (
								<div className="flex items-center gap-2 mb-2">
									{embed.author.icon_url && (
										<img
											src={embed.author.icon_url}
											alt="author avatar"
											className="w-6 h-6 rounded-full object-cover"
										/>
									)}
									<a
										className="font-semibold text-sm hover:underline"
										href={embed.author.url}
										target="_blank"
										rel="noopener noreferrer"
									>
										{embed.author.name}
									</a>
								</div>
							)}
							{embed.title && (
								<a
									className="mt-0.5 font-semibold text-blue-500 hover:underline block"
									href={embed.url}
									target="_blank"
								>
									{embed.title}
								</a>
							)}
							{embed.type !== "video" && embed.description && (
								<div className="mt-1 text-neutral-500 *:text-xs! text-xs">
									<EmbedMarkdown>{embed.description}</EmbedMarkdown>
								</div>
							)}
							{embed.fields && embed.fields.length > 0 && (
								<div className={cn("mt-3 grid gap-2", gridCols)}>
									{embed.fields.map((field, fieldIdx) => {
										const colSpan = field.inline ? "col-span-1" : "col-span-3";

										return (
											<div
												key={fieldIdx}
												className={`min-w-0 w-fit ${colSpan}`}
											>
												<div className="font-semibold text-sm mb-0.5">
													{field.name}
												</div>
												<div className="text-neutral-500 *:text-xs! text-xs wrap-break-word">
													<EmbedMarkdown>{field.value}</EmbedMarkdown>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{hasSmallThumbnail && (
							<div
								className="ml-4"
								style={{
									gridColumn: "2",
									gridRow: "1 / 99",
									alignSelf: "start",
								}}
							>
								<img
									className="rounded object-cover"
									src={embed.thumbnail?.url}
									style={{
										maxWidth: "80px",
										maxHeight: "80px",
									}}
								/>
							</div>
						)}

						{hasLargeThumbnail && embed.thumbnail && (
							<div
								className="mt-2 max-h-[300px] overflow-hidden rounded"
								style={{ gridColumn: "1 / -1" }}
							>
								<img
									className="max-h-full overflow-hidden object-cover"
									src={embed.thumbnail.url}
									style={getScaledDownWidth({
										width: embed.thumbnail?.width!,
										height: embed.thumbnail?.height!,
									})}
								/>
							</div>
						)}

						{embed.image && (
							<div className="col-span-full mt-4 max-h-[300px] overflow-hidden rounded">
								<img
									className="max-h-full overflow-hidden object-cover"
									src={embed.image.url}
									style={getScaledDownWidth({
										width: embed.image?.width!,
										height: embed.image?.height!,
									})}
								/>
							</div>
						)}

						{embed.footer && (
							<div className="col-span-full mt-2 flex items-center">
								{embed.footer.icon_url && (
									<img
										className="mr-2 size-5 rounded-full object-contain"
										src={embed.footer.icon_url}
									/>
								)}
								<div className="flex items-center gap-1 text-[13px]">
									<p>{embed.footer.text}</p>
									{embed.timestamp && (
										<>
											•<p>{dayjs(embed.timestamp).format("M/D/YY, h:mm A")}</p>
										</>
									)}
								</div>
							</div>
						)}
					</div>
				);
			})}
		</>
	);
}

function getScaledDownWidth({
	height,
	width,
}: {
	height?: number;
	width?: number;
}) {
	if (!height || !width) {
		return {};
	}
	const MAX_WIDTH = 400;
	const MAX_HEIGHT = 300;

	const heightScale = Math.min(1, MAX_HEIGHT / height);
	const widthScale = Math.min(1, MAX_WIDTH / width);
	const scale = Math.min(heightScale, widthScale);

	const scaledWidth = Math.floor(width * scale);
	const scaledHeight = Math.floor(height * scale);

	return {
		width: `${scaledWidth}px`,
		height: `${scaledHeight}px`,
		maxWidth: "100%",
	};
}

export const EmbedMarkdown = ({ children }: { children: string | null }) => {
	if (!children) {
		return null;
	}
	const parsed = parse(children, "normal");
	return <div className="prose">{renderEmbedContent(parsed, 0)}</div>;
};

function renderEmbedContent(
	node: SingleASTNode | SingleASTNode[],
	index: number,
): React.ReactNode {
	if (Array.isArray(node)) {
		return node.map((child, i) => renderEmbedContent(child, i));
	}

	const key = index;

	function renderNodes(content: SingleASTNode | SingleASTNode[]) {
		return renderEmbedContent(content, key + 1);
	}

	switch (node.type) {
		case "text":
			return <span key={index}>{node.content}</span>;

		case "br":
			return <br key={key} />;

		case "heading": {
			// Render as bold text instead of heading in embeds
			return <strong key={key}>{renderNodes(node.content)}</strong>;
		}

		case "strikethrough":
			return <s key={key}>{renderNodes(node.content)}</s>;

		case "strong":
			return <strong key={key}>{renderNodes(node.content)}</strong>;

		case "em":
			return <em key={key}>{renderNodes(node.content)}</em>;

		case "underline":
			return <u key={key}>{renderNodes(node.content)}</u>;

		case "inlineCode":
		case "codeBlock":
			return (
				<span key={key} className="bg-neutral-300 p-0.5 border">
					{node.content}
				</span>
			);

		case "link":
		case "url":
			return (
				<a
					href={node.target}
					key={key}
					target="_blank"
					rel="noopener noreferrer"
				>
					{renderNodes(node.content)}
				</a>
			);

		case "emoji":
			return (
				<CustomEmoji
					animated={node.animated}
					className="size-4.5"
					emojiId={node.id}
					key={key}
					name={node.name}
				/>
			);

		case "twemoji":
			return <Twemoji className="size-4.5" key={key} name={node.name} />;

		case "user":
			return <span key={key}>@{node.id}</span>;

		case "channel":
			return <span key={key}>#{node.id}</span>;

		case "role":
			return <span key={key}>@{node.id}</span>;

		case "everyone":
			return <span key={key}>@everyone</span>;

		case "here":
			return <span key={key}>@here</span>;

		case "timestamp":
			return <span key={key}>&lt;t:{node.timestamp}&gt;</span>;

		case "spoiler":
			return <Spoiler key={key}>{renderNodes(node.content)}</Spoiler>;

		case "blockQuote":
			return <blockquote key={key}>{renderNodes(node.content)}</blockquote>;

		case "list":
			return (
				<DiscorMarkdownList
					items={node.items as SingleASTNode[][]}
					key={key}
					ordered={node.ordered}
				/>
			);

		case "guildNavigation":
			return null;

		default:
			return null;
	}
}
