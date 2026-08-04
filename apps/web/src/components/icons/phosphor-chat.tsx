import {
	type ComponentPropsWithoutRef,
	forwardRef,
	type ReactNode,
} from "react";

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

interface IconProps extends ComponentPropsWithoutRef<"svg"> {
	alt?: string;
	color?: string;
	size?: string | number;
	weight?: IconWeight;
	mirrored?: boolean;
}

interface IconBaseProps extends IconProps {
	children: ReactNode;
}

const IconBase = forwardRef<SVGSVGElement, IconBaseProps>(function IconBase(
	{
		alt,
		color = "currentColor",
		size = "1em",
		mirrored = false,
		weight: _weight,
		children,
		...props
	},
	ref,
) {
	return (
		<svg
			fill={color}
			height={size}
			ref={ref}
			transform={mirrored ? "scale(-1, 1)" : undefined}
			viewBox="0 0 256 256"
			width={size}
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			{alt ? <title>{alt}</title> : null}
			{children}
		</svg>
	);
});

// Paths are vendored from @phosphor-icons/react 2.1.10 (MIT).
export const ChatCircleIcon = forwardRef<SVGSVGElement, IconProps>(
	function ChatCircleIcon(props, ref) {
		return (
			<IconBase {...props} ref={ref}>
				<path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z" />
			</IconBase>
		);
	},
);

export const ChatsCircleIcon = forwardRef<SVGSVGElement, IconProps>(
	function ChatsCircleIcon(props, ref) {
		return (
			<IconBase {...props} ref={ref}>
				<path d="M232.07,186.76a80,80,0,0,0-62.5-114.17A80,80,0,1,0,23.93,138.76l-7.27,24.71a16,16,0,0,0,19.87,19.87l24.71-7.27a80.39,80.39,0,0,0,25.18,7.35,80,80,0,0,0,108.34,40.65l24.71,7.27a16,16,0,0,0,19.87-19.86ZM62,159.5a8.28,8.28,0,0,0-2.26.32L32,168l8.17-27.76a8,8,0,0,0-.63-6,64,64,0,1,1,26.26,26.26A8,8,0,0,0,62,159.5Zm153.79,28.73L224,216l-27.76-8.17a8,8,0,0,0-6,.63,64.05,64.05,0,0,1-85.87-24.88A79.93,79.93,0,0,0,174.7,89.71a64,64,0,0,1,41.75,92.48A8,8,0,0,0,215.82,188.23Z" />
			</IconBase>
		);
	},
);

export const ChatsTeardropIcon = forwardRef<SVGSVGElement, IconProps>(
	function ChatsTeardropIcon(props, ref) {
		return (
			<IconBase {...props} ref={ref}>
				<path d="M169.57,72.59A80,80,0,0,0,16,104v64a16,16,0,0,0,16,16H86.67A80.15,80.15,0,0,0,160,232h64a16,16,0,0,0,16-16V152A80,80,0,0,0,169.57,72.59ZM32,104a64,64,0,1,1,64,64H32ZM224,216H160a64.14,64.14,0,0,1-55.68-32.43A79.93,79.93,0,0,0,174.7,89.71,64,64,0,0,1,224,152Z" />
			</IconBase>
		);
	},
);

export const ChatTeardropIcon = forwardRef<SVGSVGElement, IconProps>(
	function ChatTeardropIcon({ weight = "regular", ...props }, ref) {
		return (
			<IconBase {...props} ref={ref}>
				{weight === "duotone" ? (
					<path
						d="M224,124h0a92,92,0,0,1-92,92H48a8,8,0,0,1-8-8V124a92,92,0,0,1,92-92h0A92,92,0,0,1,224,124Z"
						opacity="0.2"
					/>
				) : null}
				<path
					d={
						weight === "fill"
							? "M232,124A100.11,100.11,0,0,1,132,224H48a16,16,0,0,1-16-16V124a100,100,0,0,1,200,0Z"
							: "M132,24A100.11,100.11,0,0,0,32,124v84a16,16,0,0,0,16,16h84a100,100,0,0,0,0-200Zm0,184H48V124a84,84,0,1,1,84,84Z"
					}
				/>
			</IconBase>
		);
	},
);

export const ChatIcon = forwardRef<SVGSVGElement, IconProps>(function ChatIcon(
	{ weight = "regular", ...props },
	ref,
) {
	return (
		<IconBase {...props} ref={ref}>
			{weight === "duotone" ? (
				<path
					d="M224,64V192a8,8,0,0,1-8,8H80L45.15,230.11A8,8,0,0,1,32,224V64a8,8,0,0,1,8-8H216A8,8,0,0,1,224,64Z"
					opacity="0.2"
				/>
			) : null}
			<path d="M216,48H40A16,16,0,0,0,24,64V224a15.84,15.84,0,0,0,9.25,14.5A16.05,16.05,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,224h0ZM216,192H80a8,8,0,0,0-5.23,1.95L40,224V64H216Z" />
		</IconBase>
	);
});
