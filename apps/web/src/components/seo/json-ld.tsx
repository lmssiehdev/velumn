import { JsonLd } from "react-schemaorg";
import type {
	Article,
	BreadcrumbList,
	FAQPage,
	Organization,
	WebSite,
	WithContext,
} from "schema-dts";
import { absoluteUrl, ORGANIZATION_SAME_AS, SITE_NAME } from "@/lib/seo";
import { sanitizeJsonLd } from "@/utils/sanitize";

type FaqItem = {
	question: string;
	answer: string;
};

type BreadcrumbItem = {
	name: string;
	item: string;
};

export function OrganizationJsonLd() {
	return (
		<JsonLd<Organization>
			item={sanitizeJsonLd<WithContext<Organization>>({
				"@context": "https://schema.org",
				"@type": "Organization",
				name: SITE_NAME,
				url: absoluteUrl("/"),
				logo: absoluteUrl("/icons/favicon.png"),
				sameAs: ORGANIZATION_SAME_AS,
			})}
		/>
	);
}

export function WebsiteJsonLd() {
	return (
		<JsonLd<WebSite>
			item={sanitizeJsonLd<WithContext<WebSite>>({
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: SITE_NAME,
				url: absoluteUrl("/"),
			})}
		/>
	);
}

export function FaqJsonLd({ items }: { items: FaqItem[] }) {
	return (
		<JsonLd<FAQPage>
			item={sanitizeJsonLd<WithContext<FAQPage>>({
				"@context": "https://schema.org",
				"@type": "FAQPage",
				mainEntity: items.map((item) => ({
					"@type": "Question",
					name: item.question,
					acceptedAnswer: {
						"@type": "Answer",
						text: item.answer,
					},
				})),
			})}
		/>
	);
}

export function ArticleJsonLd({
	headline,
	description,
	url,
	image,
	datePublished,
	dateModified,
}: {
	headline: string;
	description: string;
	url: string;
	image: string;
	datePublished: string;
	dateModified?: string;
}) {
	return (
		<JsonLd<Article>
			item={sanitizeJsonLd<WithContext<Article>>({
				"@context": "https://schema.org",
				"@type": "Article",
				headline,
				description,
				url,
				image,
				datePublished,
				dateModified: dateModified ?? datePublished,
				author: {
					"@type": "Organization",
					name: SITE_NAME,
				},
				publisher: {
					"@type": "Organization",
					name: SITE_NAME,
					logo: {
						"@type": "ImageObject",
						url: absoluteUrl("/icons/favicon.png"),
					},
				},
			})}
		/>
	);
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
	return (
		<JsonLd<BreadcrumbList>
			item={sanitizeJsonLd<WithContext<BreadcrumbList>>({
				"@context": "https://schema.org",
				"@type": "BreadcrumbList",
				itemListElement: items.map((item, index) => ({
					"@type": "ListItem",
					position: index + 1,
					name: item.name,
					item: item.item,
				})),
			})}
		/>
	);
}
