import { router } from "@/server/trpc";
import { serverRouter } from "./routers/server";
import { userRouter } from "./routers/user";

export const appRouter = router({
  user: userRouter,
  server: serverRouter,
});

export type AppRouter = typeof appRouter;
