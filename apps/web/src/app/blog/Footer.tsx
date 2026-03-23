import { Twemoji } from "@/components/markdown/emoji";

export function BlogFooter() {
	return (
		<footer className="border-neutral-300 border-x border-t">
			<div className="mx-auto max-w-6xl border-x px-4 py-6">
				<div className="text-center">
					<p className="text-neutral-600 text-sm">
						Built with <Twemoji className="inline size-4.5" name="💜" /> and way
						too many Discord servers .{" "}
						<a
							className="text-neutral-900 underline transition-colors hover:text-neutral-600"
							href="https://github.com/lmssiehdev/velumn"
							rel="noopener noreferrer"
							target="_blank"
						>
							Open source on GitHub ↗
						</a>
					</p>
				</div>
			</div>
		</footer>
	);
}
