import { checkout, polar, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import {
  getBulkServersByUserId,
  setBulkServersPlanByUserId,
} from "@repo/db/helpers/servers";
import { db } from "@repo/db/index";
import { dbServer, ServerPlan } from "@repo/db/schema/discord";
import { webEnv } from "@repo/utils/env/web";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

const polarClient = new Polar({
  accessToken: webEnv.POLAR_ACCESS_TOKEN,
  // Use 'sandbox' if you're using the Polar Sandbox environment
  // Remember that access tokens, products, etc. are completely separated between environments.
  // Access tokens obtained in Production are for instance not usable in the Sandbox environment.
  server: "sandbox",
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId:
                "1319ee87-9df9-4ac9-b70c-9b041deb9f8d" ??
                "431aa38d-701a-4457-b624-61d4782ceca7",
              slug: "pro",
            },
          ],
          successUrl: "/success?checkout_id={CHECKOUT_ID}",
          authenticatedUsersOnly: true,
        }),
        webhooks({
          secret: webEnv.POLAR_WEBHOOK_SECRET,
          onPayload: async (payload) => {
            const { type, data } = payload;

            switch (type) {
              case "subscription.created":
              case "subscription.updated": {
                const guildId = data.metadata.referenceId as string;
                setBulkServersPlanByUserId(guildId, "PAID");
                break;
              }
              case "subscription.revoked":
              case "subscription.canceled": {
                const guildId = data.metadata.referenceId as string;
                setBulkServersPlanByUserId(guildId, "FREE");
                break;
              }
            }
          },
        }),
      ],
    }),
    nextCookies(),
  ],
  socialProviders: {
    discord: {
      clientId: webEnv.DISCORD_CLIENT_ID,
      clientSecret: webEnv.DISCORD_CLIENT_SECRET,
      scope: ["identify", "email", "guilds"],
      disableDefaultScope: true,
      enabled: true,
    },
  },
});
