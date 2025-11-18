import { polarClient } from "@polar-sh/better-auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { dashboardEnv } from "@/utils/env";
import type { BetterAuthServer } from "./auth";

export const authClient = createAuthClient({
	plugins: [polarClient(), inferAdditionalFields<BetterAuthServer>()],
	baseURL: dashboardEnv.NEXT_PUBLIC_VELUMN_DASHBOARD_URL!,
});
