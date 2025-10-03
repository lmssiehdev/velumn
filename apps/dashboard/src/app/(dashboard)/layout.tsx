import { getCurrentUserOrRedirect } from '@/server/user';
import { redirect } from 'next/navigation';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await getCurrentUserOrRedirect();

  if ( !user.finishedOnboarding ) {
    redirect("/onboarding")
  }

  return (
    <>
        {children}
    </>
  );
}
