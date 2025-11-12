import { z } from "zod";
import { procedure, router } from "@/server/trpc";

export const userRouter = router({
	getById: procedure.input(z.object({ id: z.string() })).query(({ input }) => ({
		id: input.id,
	})),
});
