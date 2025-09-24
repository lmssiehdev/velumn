import { AuthProvider, Providers } from "@/app/providers";
import { getCurrentUserOrRedirect } from "@/server/user";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCurrentUserOrRedirect();

  return (
    <div>
      <AuthProvider user={user}>
        <Providers>{children}</Providers>
      </AuthProvider>
    </div>
  );
}
