'use client';

import { DiscordLogoIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

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
      callbackURL: '/',
    });
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center shadow">
      <div className="w-full max-w-md border p-10">
        <div className="mb-4 text-2xl">Login to [Discord]</div>
        <Button
          className="w-full rounded-none bg-[hsl(234.935_calc(1*85.556%)_64.706%/1)] hover:bg-[hsl(234.935_calc(1*85.556%)_64.706%/1)] hover:opacity-80"
          onClick={() => handleSingIn()}
        >
          <DiscordLogoIcon className="size-6" />
          Continue with Discord
        </Button>
      </div>
    </div>
  );
}
