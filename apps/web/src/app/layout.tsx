import type { Metadata } from "next";
import "./globals.css";
import { questrial } from "../styles/fonts";

export const metadata: Metadata = {
	title: "Velumn - The community platform built for Discord",
	description: "Make your community discoverable in search, AI, and beyond ✨",
	icons: {
		icon: ["/icons/favicon.svg"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<link href="/favicon.png" rel="alternate icon" type="image/png" />
			<body
				className={`${questrial.variable} bg-[#fefcf6] font-sans antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
