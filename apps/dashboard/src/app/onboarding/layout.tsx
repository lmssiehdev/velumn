import { Providers } from '@/app/providers';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Providers>{children}</Providers>
    </div>
  );
}
