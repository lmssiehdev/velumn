import { getLanguageFromFileName, highlightCode } from "@/utils/shiki";

export async function Code({
	code,
	language,
	isInline = false,
}: {
	code: string;
	language?: string;
	isInline?: boolean;
}) {
	const preferredLanguage = getLanguageFromFileName(language ?? "");
	const highlightedCode = await highlightCode(code, preferredLanguage);

	if (isInline) {
		return (
			<span
				className="inline-code not-prose inline-block rounded border border-neutral-300 text-sm *:whitespace-normal"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: required by shiki for code highlighting
				dangerouslySetInnerHTML={{
					__html: highlightedCode,
				}}
			/>
		);
	}
	return (
		<div
			className="not-prose overflow-auto rounded border border-neutral-300 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-700 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: required by shiki for code highlighting
			dangerouslySetInnerHTML={{
				__html: highlightedCode,
			}}
		/>
	);
}
