import Link from "next/link";

export default function MdxLayout({ children }: { children: React.ReactNode }) {
	return (
		<div>
			<div className="border-neutral-300 border-b">
				<div
					className="mx-auto max-w-5xl h-[52px]
                  border-neutral-300 border-x p-2 px-4 flex
                    items-center justify-between"
				>
					<Link className="text-black text-xl" href="/">
						Velumn
					</Link>
					<ul>
						<li>
							<Link href="/blog">All posts</Link>
						</li>
					</ul>
				</div>
			</div>

			<main>{children}</main>
		</div>
	);
}
