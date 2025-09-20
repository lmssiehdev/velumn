'use client';
import { authClient } from '@/lib/auth-client';

export default function Home() {
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
      <div>
        <button onClick={handleSingIn}>Sign In</button>
      </div>
    </div>
  );
}
