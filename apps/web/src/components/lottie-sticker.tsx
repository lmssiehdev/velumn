"use client";

import { useQuery } from "@tanstack/react-query";
import Lottie from "lottie-react";

export default function LottieStickerInner({
	stickerId,
}: {
	stickerId: string;
}) {
	const { data, isLoading, error } = useQuery({
		queryKey: ["lottie-sticker", stickerId],
		queryFn: async () => {
			const response = await fetch(`/assets/stickers/${stickerId}.json`);
			if (!response.ok) {
				throw new Error("Failed to fetch Lottie sticker");
			}
			return response.json();
		},
		staleTime: Infinity,
	});

	if (isLoading) {
		return <div className="h-40 w-40 animate-pulse bg-gray-200 rounded" />;
	}

	if (error) {
		return (
			<div className="h-40 w-40 flex items-center justify-center bg-gray-100 rounded">
				<span className="text-sm text-gray-500">Failed to load sticker</span>
			</div>
		);
	}

	return (
		<div className="h-40 w-40">
			<Lottie animationData={data} loop autoplay className="h-full w-full" />
		</div>
	);
}
