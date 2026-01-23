import type { Metadata } from "next";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { outfitFont } from "../styles/fonts";

export const metadata: Metadata = {
	title: "Dashboard",
	robots: "noindex, nofollow, nosnippet, noarchive, nocache",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${outfitFont.variable} font-sans antialiased`}>
				<NuqsAdapter>{children}</NuqsAdapter>
				<Toaster className="font-normal font-sans" />
			</body>
		</html>
	);
}
