"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { DiscordLogoIcon } from "@phosphor-icons/react/dist/ssr";


// TODO: add a pretty description and tidy things up :)
export default function SignIn() {
    async function handleSingIn() {
        await authClient.signIn.social({
            provider: 'discord',
            errorCallbackURL: '/error',
            /**
             * A URL to redirect if the user is newly registered
             */
            newUserCallbackURL: '/onboarding',
        });
    }

    return <div className="h-screen flex flex-col items-center justify-center shadow">
        <div className="max-w-md w-full border p-10">
            <div className="text-2xl mb-4">Login to [Discord]</div>
            <Button onClick={() => handleSingIn()} className="rounded-none w-full bg-[hsl(234.935_calc(1*85.556%)_64.706%/1)] hover:bg-[hsl(234.935_calc(1*85.556%)_64.706%/1)] hover:opacity-80"
            >
                <DiscordLogoIcon className="size-6" />
                Continue with Discord
            </Button>
        </div>
    </div>
}