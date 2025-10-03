import { redirect } from 'next/navigation';
import { getCurrentUserOrRedirect } from '@/server/user';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await getCurrentUserOrRedirect();

  if (!user.finishedOnboarding) {
    redirect('/onboarding');
  }

  return <>{children}</>;
}
