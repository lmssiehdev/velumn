import { TrackLink } from "@/components/analytics/track-link";
import { buttonVariants } from "@/components/ui/button";

const ctas = {
	default: {
		headline: "Ready to get your Discord discovered on Google?",
		subtext: "Same conversations, twice the reach. No extra work.",
		cta: "Get Started",
	},
} as const;

type BlogCTAVariant = keyof typeof ctas;

export function BlogCTA({ variant = "default" }: { variant?: BlogCTAVariant }) {
	const selected = ctas[variant];

	return (
		<div className="space-y-6 rounded max-w-6xl border bg-white px-8 py-30 mx-auto text-center">
			<h3 className="font-bold text-3xl leading-tight">{selected.headline}</h3>
			<p className="text-neutral-700 text-lg max-w-2xl mx-auto">
				{selected.subtext}
			</p>
			<div className="flex gap-3 justify-center items-center">
				<TrackLink
					eventKey="addServer"
					eventData={{
						source: "blog-cta",
						variant: variant,
					}}
					className={buttonVariants({ size: "lg" })}
					href="https://dashboard.velumn.com"
					rel="noopener"
					target="_blank"
				>
					{selected.cta}
				</TrackLink>
				<TrackLink
					eventKey="viewDemo"
					eventData={{
						source: "blog-cta-secondary",
						variant: variant,
					}}
					className={buttonVariants({ size: "lg", variant: "outline" })}
					href="https://velumn.com/thread/1436230598959300718/a_demo_thread"
				>
					See Live Demo
				</TrackLink>
			</div>
			<p className="text-neutral-500 text-sm">
				Free forever • No credit card required • 2 minute setup
			</p>
		</div>
	);
}
