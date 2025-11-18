import { polarClient } from "@polar-sh/better-auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { BetterAuthServer } from "./auth";

export const authClient = createAuthClient({
	plugins: [polarClient(), inferAdditionalFields<BetterAuthServer>()],
	baseURL: process.env.NEXT_PUBLIC_VELUMN_DASHBOARD_URL!,
});
