import { router } from '@/server/trpc';
import { userRouter } from './routers/user';
import { serverRouter } from './routers/server';

export const appRouter = router({
  user: userRouter,
  server: serverRouter,
});

export type AppRouter = typeof appRouter;
