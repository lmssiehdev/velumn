"use client";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  async function handleSingIn() {
      await authClient.signIn.social({
      provider: "discord",
      errorCallbackURL: "/error",
      /**
       * A URL to redirect if the user is newly registered
       */
      newUserCallbackURL: "/onboarding",
  });

  }
  return (
    <div className="font-sans g min-h-screen p-8 pb-20 gap-16 sm:p-20">
      Hello Sir;
      <div>
        <button onClick={handleSingIn}>Sign In</button>
      </div>
    </div>
  );
}
