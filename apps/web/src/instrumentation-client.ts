import posthog from "posthog-js";
import { webEnv } from "./utils/env";

posthog.init(webEnv.NEXT_PUBLIC_POSTHOG_KEY, {
	api_host: "/api/hog",
	ui_host: "https://us.posthog.com",
	defaults: "2025-11-30",
	person_profiles: "always",
});
