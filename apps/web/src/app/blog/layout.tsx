import Link from "next/link";

export default function MdxLayout({ children }: { children: React.ReactNode }) {
	return (
		<div>
			<div className="border-neutral-300 border-b">
				<div className="mx-auto flex h-[52px] max-w-5xl items-center justify-between border-x border-neutral-300 p-2 px-4">
					<Link className="text-black text-xl" href="/">
						Velumn
					</Link>
					<nav aria-label="Blog" className="flex items-center gap-4 text-sm">
						<Link className="hover:underline" href="/blog">
							All posts
						</Link>
						<Link className="hover:underline" href="/pricing">
							Pricing
						</Link>
					</nav>
				</div>
			</div>

			<main>{children}</main>
		</div>
	);
}
