import type { DBMessage } from "@repo/db/schema/discord";
import { dayjs } from "@repo/utils/helpers/dayjs";

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
								<a
									className="mt-2 font-semibold text-sm hover:underline"
									href={embed.author.url}
									target="_blank"
								>
									{embed.author.name}
								</a>
							)}
							{embed.title && (
								<a
									className="mt-2 font-semibold text-blue-500 hover:underline"
									href={embed.url}
									target="_blank"
								>
									{embed.title}
								</a>
							)}
							{embed.type !== "video" && embed.description && (
								<div className="mt-1 text-neutral-500 *:text-xs! text-xs">
									{/* TODO: create a markdown parser for markdown only  */}
									{/* <DiscordMarkdown message={undefined}> */}
									{embed.description}
									{/* </DiscordMarkdown> */}
								</div>
							)}
							{embed.fields && embed.fields.length > 0 && (
								<div className="mt-3 grid grid-cols-3 gap-2">
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
												<div className="text-neutral-500 text-sm wrap-break-word">
													{field.value}
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
							<div
								className="mt-2 max-h-[300px] overflow-hidden rounded"
								style={{ gridColumn: "1 / -1" }}
							>
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
