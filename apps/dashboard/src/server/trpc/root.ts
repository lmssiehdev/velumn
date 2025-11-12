import { createCallerFactory, router } from "@/server/trpc";
import { createContext } from "./context";
import { serverRouter } from "./routers/server";
import { userRouter } from "./routers/user";

export const appRouter = router({
	user: userRouter,
	server: serverRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);

/**
 * Server-side tRPC API
 */
export const createServerApi = async () => {
	const ctx = await createContext();
	return createCaller(ctx);
};
