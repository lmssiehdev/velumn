import { indexingRouter } from "./routers/indexing";
import { searchRouter } from "./routers/search";
import { votesRouter } from "./routers/votes";
import { mergeRouters } from "./trpc";

export const botRouter = mergeRouters(
	indexingRouter,
	searchRouter,
	votesRouter,
);

export type BotRouter = typeof botRouter;
