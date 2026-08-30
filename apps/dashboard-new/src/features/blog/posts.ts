import type { ComponentType } from "react"
import { z } from "zod"

import { formatUtcDate } from "@/lib/date"

export interface PostMetadata {
  title: string
  description: string
  publishedAt: string
  updatedAt?: string
  category?: string
  readTime?: string
  thumbnail?: string
  thumbnailAlt?: string
}

interface PostModule {
  default: ComponentType
  metadata: unknown
}

export interface PostSummary {
  slug: string
  metadata: PostMetadata
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
  })

const nonEmptyStringSchema = z.string().trim().min(1)

const postMetadataSchema = z
  .object({
    title: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    publishedAt: isoDateSchema,
    updatedAt: isoDateSchema.optional(),
    category: nonEmptyStringSchema.optional(),
    readTime: nonEmptyStringSchema.optional(),
    thumbnail: nonEmptyStringSchema.optional(),
    thumbnailAlt: nonEmptyStringSchema.optional(),
  })
  .superRefine((metadata, context) => {
    if (metadata.thumbnail && !metadata.thumbnailAlt) {
      context.addIssue({
        code: "custom",
        message: "thumbnailAlt is required when thumbnail is present",
        path: ["thumbnailAlt"],
      })
    }
    if (metadata.updatedAt && metadata.updatedAt < metadata.publishedAt) {
      context.addIssue({
        code: "custom",
        message: "updatedAt cannot be earlier than publishedAt",
        path: ["updatedAt"],
      })
    }
  })

const postExclusionCandidateSchema = z
  .object({
    draft: z.literal(true).optional().catch(undefined),
    placeholder: z.literal(true).optional().catch(undefined),
    title: z.string().optional().catch(undefined),
    description: z.string().optional().catch(undefined),
    publishedAt: isoDateSchema.optional().catch(undefined),
  })
  .catch({})

const rawPostSourceSchema = z.union([
  z.string(),
  z.object({ default: z.string() }).transform((source) => source.default),
])

const postModules = import.meta.glob<PostModule>(
  "/src/content/blog/published/*.mdx",
  { eager: true }
)
const postSources = import.meta.glob<unknown>(
  "/src/content/blog/published/*.mdx",
  {
    eager: true,
    import: "default",
    query: "?raw",
  }
)

export const posts = Object.entries(postModules)
  .flatMap(([path, postModule]) => {
    const slug = path.slice(path.lastIndexOf("/") + 1, -4)
    const source = postSources[path]

    if (shouldExcludePost(slug, postModule.metadata)) return []

    const metadata = validateMetadata(slug, postModule.metadata)
    const rawSource = getRawSource(source)
    if (rawSource !== null && !hasContentBody(rawSource)) {
      throw new Error(`Blog post "${slug}" must have a non-empty body`)
    }

    return [{ slug, metadata }]
  })
  .sort(
    (a, b) =>
      Date.parse(b.metadata.publishedAt) - Date.parse(a.metadata.publishedAt)
  )

const postsBySlug = new Map(posts.map((post) => [post.slug, post]))
const postComponents = new Map(
  Object.entries(postModules).map(([path, postModule]) => [
    path.slice(path.lastIndexOf("/") + 1, -4),
    postModule.default,
  ])
)

export function getPost(slug: string) {
  return postsBySlug.get(slug)
}

export function getPostComponent(slug: string) {
  if (!postsBySlug.has(slug)) return undefined
  return postComponents.get(slug)
}

export function formatPublishedAt(value: string) {
  return formatUtcDate(`${value}T00:00:00Z`, "long")
}

function shouldExcludePost(
  slug: string,
  value: Parameters<typeof postExclusionCandidateSchema.parse>[0]
) {
  const candidate = postExclusionCandidateSchema.parse(value)
  if (candidate.draft || candidate.placeholder) return true

  const identifyingText = [slug, candidate.title, candidate.description]
    .filter((part): part is string => part !== undefined)
    .join(" ")

  if (/\b(?:draft|placeholder|todo|coming soon)\b/i.test(identifyingText)) {
    return true
  }

  return candidate.publishedAt
    ? Date.parse(`${candidate.publishedAt}T00:00:00Z`) > Date.now()
    : false
}

function validateMetadata(
  slug: string,
  value: Parameters<typeof postMetadataSchema.safeParse>[0]
): PostMetadata {
  const parsed = postMetadataSchema.safeParse(value)
  if (!parsed.success) throw invalidMetadata(slug)
  return parsed.data
}

function hasContentBody(source: string) {
  const metadataStart = source.indexOf("export const metadata")
  if (metadataStart === -1) return source.trim().length > 0

  const openingBrace = source.indexOf("{", metadataStart)
  if (openingBrace === -1) return false

  let depth = 0
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1
    if (source[index] === "}") depth -= 1
    if (depth === 0) {
      return source.slice(index + 1).trim().length > 0
    }
  }

  return false
}

function getRawSource(
  value: Parameters<typeof rawPostSourceSchema.safeParse>[0]
): string | null {
  const parsed = rawPostSourceSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function invalidMetadata(slug: string) {
  return new Error(`Blog post "${slug}" has invalid metadata`)
}
