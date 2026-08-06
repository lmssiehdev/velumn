import type { Metadata } from "next";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import NewLandingPage from "./new-landing/page";

export { FAQ } from "./new-landing/page";

export const dynamic = "force-static";

export const metadata: Metadata = buildPageMetadata({
	title: "Help More People Find Your Discord Community",
	description:
		"Turn selected Discord threads into public, search-friendly pages that help people find your answers and join your community.",
	canonicalUrl: absoluteUrl("/"),
});

export default function Home() {
	return (
		<>
			<OrganizationJsonLd />
			<WebsiteJsonLd />
			<NewLandingPage />
		</>
	);
}
