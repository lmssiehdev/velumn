"use client";

import type { DBMessage } from "@repo/db/schema/discord";
import { StickerFormatType } from "discord-api-types/v10";
import dynamic from "next/dynamic";
import { DynamicQueryProvider } from "../dynamic-react-query-provider";

const LottieSticker = dynamic(() => import("../lottie-sticker"), {
	ssr: false,
});

export function Stickers({ stickers }: { stickers: DBMessage["stickers"] }) {
	if (!stickers?.length) {
		return null;
	}
	return (
		<div className="size-40">
			<DynamicQueryProvider>
				<StickersInner stickers={stickers} />
			</DynamicQueryProvider>
		</div>
	);
}

export function StickersInner({
	stickers,
}: {
	stickers: DBMessage["stickers"];
}) {
	if (!stickers?.length) {
		return null;
	}
	return (
		<>
			{stickers.map((sticker) => {
				if (sticker.format === StickerFormatType.Lottie) {
					return <LottieSticker key={sticker.id} stickerId={sticker.id} />;
				}
				const url =
					sticker.format === StickerFormatType.GIF
						? `https://media.discordapp.net/stickers/${sticker.id}.gif`
						: `https://cdn.discordapp.com/stickers/${sticker.id}.png`;

				return (
					<div key={sticker.id} className="h-40 w-40">
						<img
							src={url}
							className="h-full w-full object-contain"
							loading="lazy"
						/>
					</div>
				);
			})}
		</>
	);
}
