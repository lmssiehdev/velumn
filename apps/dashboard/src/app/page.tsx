'use client';

import { authClient } from '@/lib/auth-client';
export default function Home() {
  async function Paymebaby() {
    await authClient.checkout({
      products: ['1319ee87-9df9-4ac9-b70c-9b041deb9f8d'],
      slug: 'pro',
    });
    return;
  }

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
  return (
    <div className="g min-h-screen gap-16 p-8 pb-20 font-sans sm:p-20">
      Hello Sir;
      <div className="flex flex-col gap-2">
        <button onClick={handleSingIn} type="button">
          Sign In
        </button>
        <button onClick={Paymebaby} type="button">
          Paymebaby
        </button>
      </div>
    </div>
  );
}
