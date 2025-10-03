import { polarClient } from '@polar-sh/better-auth';
import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { BetterAuthServer } from './auth';


export const authClient = createAuthClient({
  plugins: [polarClient(), inferAdditionalFields<BetterAuthServer>()],
  baseURL: process.env.BETTER_AUTH_URL!
});


const { useSession } = authClient;
