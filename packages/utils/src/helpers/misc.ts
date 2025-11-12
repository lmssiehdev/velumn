export const isEmbeddableAttachment = (a: {
	contentType: string | null;
	proxyURL: string;
}) => a.contentType?.startsWith("image/") && !a.proxyURL?.endsWith(".svg");
