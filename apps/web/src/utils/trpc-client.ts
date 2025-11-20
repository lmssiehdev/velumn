import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { BotRouter } from "../../../bot/src/helpers/trpc";

export const botClient = createTRPCClient<BotRouter>({
	links: [
		httpBatchLink({
			url: `${process.env.NEXT_PUBLIC_VELUMN_API_URL}/trpc`,
		}),
	],
});
