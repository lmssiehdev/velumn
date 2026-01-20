import { db } from "@repo/db/index";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { dashboardEnv } from "@/utils/env";

// const polarClient = new Polar({
// 	accessToken: process.env.POLAR_ACCESS_TOKEN,
// 	// Use 'sandbox' if you're using the Polar Sandbox environment
// 	// Remember that access tokens, products, etc. are completely separated between environments.
// 	// Access tokens obtained in Production are for instance not usable in the Sandbox environment.
// 	server: "sandbox",
// });

export type AuthUser = typeof auth.$Infer.Session.user;
export type BetterAuthServer = typeof auth;

export const auth = betterAuth({
	user: {
		// No additional fields needed - server relations handled via user_servers table
	},
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	trustedOrigins: [dashboardEnv.NEXT_PUBLIC_VELUMN_DASHBOARD_URL!],
	plugins: [
		// polar({
		// 	client: polarClient,
		// 	createCustomerOnSignUp: true,
		// 	use: [
		// 		checkout({
		// 			products: [
		// 				{
		// 					productId: "1319ee87-9df9-4ac9-b70c-9b041deb9f8d",
		// 					slug: "pro",
		// 				},
		// 			],
		// 			successUrl: "/success?checkout_id={CHECKOUT_ID}",
		// 			authenticatedUsersOnly: true,
		// 		}),
		// 		webhooks({
		// 			secret: process.env.POLAR_WEBHOOK_SECRET!,
		// 			onPayload: async (payload) => {
		// 				const { type, data } = payload;
		// 				console.log({
		// 					// @ts-expect-error meh
		// 					referenceId: data?.metadata?.referenceId,
		// 				});
		// 				try {
		// 					switch (type) {
		// 						case "subscription.created":
		// 						case "subscription.updated": {
		// 							const guildId = data.metadata.referenceId as string;
		// 							setServerPlanById(guildId, "PAID");
		// 							break;
		// 						}
		// 						case "subscription.revoked":
		// 						case "subscription.canceled": {
		// 							const guildId = data.metadata.referenceId as string;
		// 							setServerPlanById(guildId, "FREE");
		// 							break;
		// 						}
		// 					}
		// 				} catch (e) {
		// 					parseError(e);
		// 				}
		// 			},
		// 		}),
		// 	],
		// }),
		nextCookies(),
	],
	socialProviders: {
		discord: {
			clientId: dashboardEnv.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
			clientSecret: dashboardEnv.DISCORD_CLIENT_SECRET!,
			scope: ["identify", "email", "guilds"],
			disableDefaultScope: true,
			enabled: true,
			callbackUrl: `https://${process.env.VERCEL_URL}/api/auth/discord/callback`,
		},
	},
});
