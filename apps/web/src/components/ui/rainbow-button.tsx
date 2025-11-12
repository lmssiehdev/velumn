import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

import { cn } from "@/lib/utils";

const rainbowButtonVariants = cva(
	cn(
		"group relative animate-rainbow cursor-pointer transition-all",
		"inline-flex shrink-0 items-center justify-center gap-2",
		"rounded-sm outline-none focus-visible:ring-[3px] aria-invalid:border-destructive",
		"whitespace-nowrap font-medium text-sm",
		"disabled:pointer-events-none disabled:opacity-50",
		"[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	),
	{
		variants: {
			variant: {
				default:
					"before:-translate-x-1/2 border-0 bg-[length:200%] bg-[linear-gradient(#121213,#121213),linear-gradient(#121213_50%,rgba(18,18,19,0.6)_80%,rgba(18,18,19,0)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] text-primary-foreground [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.125rem)_solid_transparent] before:absolute before:bottom-[-0%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:animate-rainbow before:bg-[linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] dark:bg-[linear-gradient(#fff,#fff),linear-gradient(#fff_50%,rgba(255,255,255,0.6)_80%,rgba(0,0,0,0)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] before:[filter:blur(0.75rem)]",
				outline:
					"before:-translate-x-1/2 border border-input border-b-transparent bg-[length:200%] bg-[linear-gradient(#ffffff,#ffffff),linear-gradient(#ffffff_50%,rgba(18,18,19,0.6)_80%,rgba(18,18,19,0)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] text-accent-foreground [background-clip:padding-box,border-box,border-box] [background-origin:border-box] before:absolute before:bottom-0 before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:animate-rainbow before:bg-[linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] dark:bg-[linear-gradient(#0a0a0a,#0a0a0a),linear-gradient(#0a0a0a_50%,rgba(255,255,255,0.6)_80%,rgba(0,0,0,0)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] before:[filter:blur(0.75rem)]",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 rounded-xl px-3 text-xs",
				lg: "h-11 rounded-xl px-8",
				icon: "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

interface RainbowButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof rainbowButtonVariants> {
	asChild?: boolean;
}

const RainbowButton = React.forwardRef<HTMLButtonElement, RainbowButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(rainbowButtonVariants({ variant, size, className }))}
				data-slot="button"
				ref={ref}
				{...props}
			/>
		);
	},
);

RainbowButton.displayName = "RainbowButton";

export { RainbowButton, rainbowButtonVariants, type RainbowButtonProps };
