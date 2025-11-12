import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "About Velumn";
export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";
export default async function Image() {
	const questrial = await readFile(
		join(process.cwd(), "assets/Questrial-Regular.ttf"),
	);

	return new ImageResponse(
		<div
			style={{
				height: "100%",
				width: "100%",
				backgroundColor: "#fefcf6",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "Questrial",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: "20px",
				}}
			>
				<div
					style={{
						fontSize: 80,
						textAlign: "center",
						lineHeight: 1.2,
						letterSpacing: "-0.02em",
					}}
				>
					The community platform built
				</div>
				<div
					style={{
						fontSize: 80,
						textAlign: "center",
						lineHeight: 1.2,
						letterSpacing: "-0.02em",
					}}
				>
					for Discord
				</div>

				<div
					style={{
						width: "120px",
						height: "6px",
						background: "rgba(255, 255, 255, 0.8)",
						borderRadius: "3px",
						marginTop: "10px",
					}}
				/>
			</div>

			<div
				style={{
					fontSize: 33,
					position: "absolute",
					display: "flex",
					bottom: "5%",
					right: "3%",
				}}
			>
				<LogoIcon size={33} />
				Velumn
			</div>
		</div>,
		{
			...size,
			fonts: [
				{
					name: "Questrial",
					data: questrial,
					style: "normal",
					weight: 400,
				},
			],
		},
	);
}

const LogoIcon = ({ size }: { size: number }) => (
	<svg
		height={size}
		style={{
			color: "#404040",
			marginRight: "8px",
		}}
		viewBox="0 0 256 256"
		width={size}
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M169.57 72.59A80 80 0 0 0 16 104v64a16 16 0 0 0 16 16h54.67A80.15 80.15 0 0 0 160 232h64a16 16 0 0 0 16-16v-64a80 80 0 0 0-70.43-79.41M32 104a64 64 0 1 1 64 64H32Zm192 112h-64a64.14 64.14 0 0 1-55.68-32.43 79.93 79.93 0 0 0 70.38-93.86A64 64 0 0 1 224 152Z" />
	</svg>
);
