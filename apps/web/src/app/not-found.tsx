import ArrowLeft02Icon from "@hugeicons/core-free-icons/ArrowLeft02Icon";
import ArrowUpRight03Icon from "@hugeicons/core-free-icons/ArrowUpRight03Icon";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
	return (
		<div className="mx-auto max-w-6xl h-full">
			<section className="px-4 py-24 sm:py-32">
				<div className="mx-auto max-w-3xl rounded border bg-white/70 px-8 py-14 text-center shadow-sm backdrop-blur-sm">
					<p className="font-medium text-neutral-500 text-sm uppercase tracking-[0.28em]">
						404
					</p>
					<h1 className="mt-4 text-balance font-bold text-4xl leading-tight sm:text-5xl md:text-6xl">
						Page not found
					</h1>
					<p className="mx-auto mt-5 max-w-2xl text-balance text-base text-neutral-600 sm:text-lg">
						This page doesn&apos;t exist, may have moved, or isn&apos;t
						available on this domain.
					</p>
					<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
						<Link className={buttonVariants({ size: "lg" })} href="/">
							<HugeiconsIcon className="size-4" icon={ArrowLeft02Icon} />
							Go home
						</Link>
						<Link
							className={buttonVariants({ size: "lg", variant: "outline" })}
							href="/blog"
						>
							Read the blog
							<HugeiconsIcon className="size-4" icon={ArrowUpRight03Icon} />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
