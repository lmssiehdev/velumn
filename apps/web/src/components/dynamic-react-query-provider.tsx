import dynamic from "next/dynamic";

export const DynamicQueryProvider = dynamic(
	() => import("../app/providers").then((mod) => mod.Providers),
	{
		ssr: false,
	},
);
