"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Maximize2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicQueryProvider } from "./dynamic-react-query-provider";

interface CodeViewerProps {
	fileUrl: string;
	fileName: string;
	language?: string;
}

const fetchCode = async (url: string): Promise<string> => {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch code");
	}
	return response.text();
};

const getLanguageFromFileName = (fileName: string): string => {
	const extension = fileName.split(".").pop()?.toLowerCase();
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
	};
	return languageMap[extension || ""] || "text";
};
export default function CodeViewer({
	fileUrl,
	fileName,
	language,
}: CodeViewerProps) {
	return (
		<DynamicQueryProvider>
			<CodeViewerInner
				fileUrl={fileUrl}
				fileName={fileName}
				language={language}
			/>
		</DynamicQueryProvider>
	);
}

export const CodeViewerInner = ({
	fileUrl,
	fileName,
	language,
}: CodeViewerProps) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const {
		data: code,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["code", fileUrl],
		queryFn: () => fetchCode(fileUrl),
	});

	const detectedLanguage = language || getLanguageFromFileName(fileName);

	const handleDownload = () => {
		if (!code) return;

		const blob = new Blob([code], { type: "text/plain" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
	};

	const renderCodeLines = (codeContent: string, truncate: boolean = false) => {
		const lines = codeContent.split("\n");
		const displayLines = truncate ? lines.slice(0, 6) : lines;

		return (
			<pre className="text-sm">
				<code>
					{displayLines.map((line, index) => (
						<div key={index} className="table-row">
							<span className="table-cell pr-4 text-right select-none text-muted-foreground opacity-50 w-8">
								{index + 1}
							</span>
							<span className="table-cell">{line || "\n"}</span>
						</div>
					))}
					{truncate && lines.length > 6 && (
						<div className="text-muted-foreground italic pt-2">
							... {lines.length - 6} more lines
						</div>
					)}
				</code>
			</pre>
		);
	};

	if (isLoading) {
		return (
			<Card className="w-full bg-[#2b2d31] border-[#1e1f22] rounded-md overflow-hidden">
				<div className="p-4 text-gray-400">Loading code...</div>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className="w-full bg-[#2b2d31] border-[#1e1f22] rounded-md overflow-hidden">
				<div className="p-4 text-red-400">Error loading code</div>
			</Card>
		);
	}

	return (
		<>
			<Card className="w-full max-w-2xl bg-[#2b2d31] border-[#1e1f22] rounded-md overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1f22] bg-[#232428]">
					<span className="text-sm text-gray-300 font-medium">{fileName}</span>
					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 hover:bg-[#404249] text-gray-400 hover:text-gray-200"
							onClick={() => setIsExpanded(true)}
						>
							<Maximize2 className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="bg-[#1e1f22] p-4 overflow-hidden">
					<div className="font-mono text-gray-300 text-xs leading-5">
						{code && renderCodeLines(code, true)}
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-3 py-2 border-t border-[#1e1f22] bg-[#232428]">
					<span className="text-xs text-gray-400">{detectedLanguage}</span>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs hover:bg-[#404249] text-gray-400 hover:text-gray-200"
						onClick={handleDownload}
					>
						<Download className="h-3 w-3 mr-1" />
						Download
					</Button>
				</div>
			</Card>

			<Dialog open={isExpanded} onOpenChange={setIsExpanded}>
				<DialogContent className="max-w-4xl h-[80vh] bg-[#2b2d31] border-[#1e1f22] p-0">
					<DialogHeader className="px-4 py-3 border-b border-[#1e1f22] bg-[#232428]">
						<div className="flex items-center justify-between">
							<DialogTitle className="text-gray-300 text-base font-medium">
								{fileName}
							</DialogTitle>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 hover:bg-[#404249] text-gray-400 hover:text-gray-200"
								onClick={() => setIsExpanded(false)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</DialogHeader>

					<ScrollArea className="flex-1 h-full">
						<div className="bg-[#1e1f22] p-4">
							<div className="font-mono text-gray-300 text-xs leading-5">
								{code && renderCodeLines(code, false)}
							</div>
						</div>
					</ScrollArea>

					<div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1f22] bg-[#232428]">
						<span className="text-xs text-gray-400">{detectedLanguage}</span>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs hover:bg-[#404249] text-gray-400 hover:text-gray-200"
							onClick={handleDownload}
						>
							<Download className="h-3 w-3 mr-1" />
							Download
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
