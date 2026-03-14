import {
	ForumShell,
	FrontPageSidebar,
	ServerInfo,
} from "@/components/forum/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
	return <ForumShell>{children}</ForumShell>;
}

export { FrontPageSidebar, ServerInfo };
