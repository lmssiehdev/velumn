export const isEmbeddableAttachment = (a: { contentType: string | null; proxyUrl: string }) => a.contentType?.startsWith('image/') && !a.proxyUrl.endsWith(".svg");
