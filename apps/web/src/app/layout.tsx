import type { Metadata } from "next";
import "./globals.css";
import {
	absoluteUrl,
	getSiteUrl,
	SITE_NAME,
	SITE_TWITTER_HANDLE,
} from "@/lib/seo";
import { questrial } from "../styles/fonts";

export const metadata: Metadata = {
	applicationName: SITE_NAME,
	metadataBase: new URL(getSiteUrl()),
	title: {
		default: SITE_NAME,
		template: `%s | ${SITE_NAME}`,
	},
	icons: {
		icon: ["/icons/favicon.svg"],
	},
	openGraph: {
		siteName: SITE_NAME,
		type: "website",
		images: [
			{
				url: absoluteUrl("/opengraph-image.png"),
				width: 1200,
				height: 630,
				alt: "Velumn social preview",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		site: SITE_TWITTER_HANDLE,
		images: [
			{
				url: absoluteUrl("/opengraph-image.png"),
				alt: "Velumn social preview",
			},
		],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<link href="/icons/favicon.png" rel="alternate icon" type="image/png" />
			<body
				className={`${questrial.variable} bg-[#fefcf6] font-sans antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
