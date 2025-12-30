export const codeExtensions = [
	".js",
	".jsx",
	".ts",
	".tsx",
	".py",
	".java",
	".cpp",
	".c",
	".cs",
	".go",
	".rs",
	".rb",
	".php",
	".html",
	".css",
	".json",
	".md",
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const getEmbedFileInfo = (a: {
	contentType: string | null;
	proxyURL: string;
	size: number | null;
}): {
	isEmbeddable: boolean;
	isUploadable: boolean;
	type: "image" | "code" | "other";
} => {
	const url = a.proxyURL.toLowerCase();

	const pathname = url.split("?")[0];
	const isCode =
		pathname?.endsWith(".svg") ||
		codeExtensions.some((ext) => pathname?.endsWith(ext));
	if (
		(a.contentType?.startsWith("image/") && !pathname?.endsWith(".svg")) ||
		isCode
	) {
		if (isCode && a.size && a.size > MAX_FILE_SIZE_BYTES) {
			return {
				isEmbeddable: false,
				isUploadable: false,
				type: "other",
			};
		}
		return {
			isEmbeddable: true,
			isUploadable: true,
			type: isCode ? "code" : "image",
		};
	}

	return {
		isEmbeddable: false,
		isUploadable: false,
		type: "other",
	};
};
