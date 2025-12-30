import type { codeExtensions } from "@repo/utils/helpers/misc";
import oneLight from "@shikijs/themes/one-light";
import {
	createdBundledHighlighter,
	createSingletonShorthands,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const languageMap: Record<string, string> = {
	js: "javascript",
	jsx: "javascript",
	ts: "typescript",
	tsx: "typescript",
	py: "python",
	java: "java",
	cpp: "cpp",
	c: "c",
	cs: "csharp",
	go: "go",
	rs: "rust",
	rb: "ruby",
	php: "php",
	html: "html",
	css: "css",
	json: "json",
	md: "markdown",
	// @HACK: for the markdown-parser
	javascript: "javascript",
	typescript: "typescript",
	python: "python",
	csharp: "csharp",
	rust: "rust",
	ruby: "ruby",
	markdown: "markdown",
} satisfies Record<(typeof codeExtensions)[number], string>;

const shikiLanguages = [
	"typescript",
	"javascript",
	"java",
	"python",
	"cpp",
	"c",
	"csharp",
	"go",
	"rust",
	"ruby",
	"php",
	"html",
	"css",
	"json",
	"markdown",
];
const BundledLanguage = {
	typescript: () => import("@shikijs/langs/typescript"),
	javascript: () => import("@shikijs/langs/javascript"),
	java: () => import("@shikijs/langs/java"),
	python: () => import("@shikijs/langs/python"),
	cpp: () => import("@shikijs/langs/cpp"),
	c: () => import("@shikijs/langs/c"),
	csharp: () => import("@shikijs/langs/csharp"),
	go: () => import("@shikijs/langs/go"),
	rust: () => import("@shikijs/langs/rust"),
	ruby: () => import("@shikijs/langs/ruby"),
	php: () => import("@shikijs/langs/php"),
	html: () => import("@shikijs/langs/html"),
	css: () => import("@shikijs/langs/css"),
	json: () => import("@shikijs/langs/json"),
	markdown: () => import("@shikijs/langs/markdown"),
} satisfies Record<(typeof shikiLanguages)[number], unknown>;

const BundledTheme = {
	"one-light": () => import("@shikijs/themes/one-light"),
};

const createHighlighter = createdBundledHighlighter({
	langs: BundledLanguage,
	themes: BundledTheme,
	engine: () => createJavaScriptRegexEngine(),
});
const { codeToHtml } = createSingletonShorthands(createHighlighter);

export async function highlightCode(code: string, lang = "plaintext") {
	const html = await codeToHtml(code, {
		lang,
		theme: oneLight,
	});

	return html;
}

export function getLanguageFromFileName(fileName: string) {
	const extension = fileName.includes(".")
		? fileName.split(".").pop()?.toLowerCase()
		: fileName.toLowerCase();

	if (!extension) return "plaintext";

	const normalized = languageMap[extension];
	if (normalized) return normalized;

	if (shikiLanguages.includes(extension)) return extension;

	return "plaintext";
}
