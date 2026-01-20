import { AuthProvider, Providers } from "@/app/providers";
import { getCurrentUserOrRedirect } from "@/server/user";

export default async function OnboardingLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { user: currentUser } = await getCurrentUserOrRedirect();

	return (
		<AuthProvider user={currentUser}>
			<Providers>{children}</Providers>
		</AuthProvider>
	);
}
