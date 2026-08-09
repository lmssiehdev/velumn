import { createFileRoute } from "@tanstack/react-router"

import { NewLandingPage, faqItems } from "@/features/marketing/new-landing-page"
import newLandingCss from "@/features/marketing/new-landing.css?url"

const title = "Help More People Find Your Discord Community"
const description =
  "Turn selected Discord threads into public, search-friendly pages that help people find your answers and join your community."
const canonicalUrl = "https://velumn.com/"
const imageUrl = "https://velumn.com/opengraph-image.png"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${title} | Velumn` },
      { name: "description", content: description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:site_name", content: "Velumn" },
      { property: "og:image", content: imageUrl },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@velumn" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: imageUrl },
    ],
    links: [
      { rel: "canonical", href: canonicalUrl },
      { rel: "stylesheet", href: newLandingCss },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map(({ question, answer }) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        }),
      },
    ],
  }),
  component: NewLandingPage,
})
