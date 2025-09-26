import slugify from 'slugify';

export function getSlugFromTitle(title: string) {
  // trim long numbers from the title
  const processedTitle = title!.replace(/\d{6,}/g, (match) =>
    match.substring(0, 5)
  );

  const slug = slugify(processedTitle, {
    replacement: '_',
    lower: true,
    strict: true,
    locale: 'en',
    trim: true,
  });

  const shortenedSlug = slug.split('_').slice(0, 8).join('_');
  return shortenedSlug;
}

export function slugifyThreadUrl({ id, name }: { id: string; name: string }) {
  const slug = getSlugFromTitle(name);

  return `/thread/${id}/${slug}`;
}
