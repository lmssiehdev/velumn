import type { PostMetadata } from "@/features/blog/posts"

const siteOrigin = "https://velumn.com"
const siteName = "Velumn"
const defaultImageUrl = `${siteOrigin}/opengraph-image.png`

export function blogUrl(path = "") {
  return `${siteOrigin}/blog${path}`
}

export function blogImageUrl(metadata: PostMetadata) {
  return metadata.thumbnail
    ? new URL(metadata.thumbnail, siteOrigin).href
    : defaultImageUrl
}

export function buildBlogPostingScripts(slug: string, metadata: PostMetadata) {
  const url = blogUrl(`/${encodeURIComponent(slug)}`)
  const image = blogImageUrl(metadata)

  return [
    {
      type: "application/ld+json",
      children: escapeJsonLd(
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": `${url}#article`,
          mainEntityOfPage: url,
          url,
          headline: metadata.title,
          description: metadata.description,
          image,
          datePublished: metadata.publishedAt,
          dateModified: metadata.updatedAt ?? metadata.publishedAt,
          author: {
            "@type": "Organization",
            name: siteName,
            url: siteOrigin,
          },
          publisher: {
            "@type": "Organization",
            name: siteName,
            url: siteOrigin,
          },
          isPartOf: {
            "@type": "Blog",
            name: `${siteName} Blog`,
            url: blogUrl(),
          },
        })
      ),
    },
    {
      type: "application/ld+json",
      children: escapeJsonLd(
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: siteOrigin,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Blog",
              item: blogUrl(),
            },
            {
              "@type": "ListItem",
              position: 3,
              name: metadata.title,
              item: url,
            },
          ],
        })
      ),
    },
  ]
}

function escapeJsonLd(value: string) {
  return value.replaceAll("<", "\\u003c")
}
