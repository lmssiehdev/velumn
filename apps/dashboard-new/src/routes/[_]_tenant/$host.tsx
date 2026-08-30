import { Outlet, createFileRoute } from "@tanstack/react-router"

import questrialUrl from "../../assets/Questrial-Regular.ttf?url"
import globalsCss from "@/globals.css?url"
import { CommunitySearch } from "@/features/public-search/community-search"
import {
  TenantRouteError,
  TenantRouteNotFound,
} from "@/features/tenant-routing/components"
import { getTenantCanonicalOrigin } from "@/features/tenant-routing/functions"

export const Route = createFileRoute("/__tenant/$host")({
  loader: ({ params }) =>
    getTenantCanonicalOrigin({ data: { hostname: params.host } }),
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  head: () => ({
    links: [{ rel: "stylesheet", href: globalsCss }],
  }),
  component: TenantLayout,
  errorComponent: TenantRouteError,
  notFoundComponent: TenantRouteNotFound,
})

function TenantLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-white font-sans text-neutral-900 antialiased [--community-search-accent-soft:#eee7ff] [--community-search-accent:#6d28d9] [--community-search-bg:#fff] [--community-search-border:#d4d0ca] [--community-search-fg:#1e1e29] [--community-search-hover:#f5f5f5] [--community-search-muted:#69666f] [&_a]:text-inherit [&_a]:decoration-from-font [&_a]:underline-offset-[0.16em] [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-[3px] [&_a:focus-visible]:outline-violet-700 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-[3px] [&_button:focus-visible]:outline-violet-700">
      <style>{`@font-face{font-family:"Questrial";src:url("${questrialUrl}") format("truetype");font-style:normal;font-weight:400;font-display:swap}`}</style>
      <a
        className="fixed start-2 top-2 z-10 -translate-y-[calc(100%+1rem)] bg-neutral-900 px-3.5 py-2.5 !text-white focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="border-b border-neutral-300">
        <div className="mx-auto flex h-[3.25rem] w-full max-w-5xl items-center justify-between border-x border-neutral-300 px-4 py-2">
          <a className="text-xl no-underline" href="/">
            Velumn
          </a>
          <CommunitySearch />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-2 pt-2 pb-10">
        <Outlet />
      </div>
      <footer className="border border-b-0 border-neutral-300">
        <div className="mx-auto w-full max-w-5xl px-4 py-2">
          Powered by Velumn
        </div>
      </footer>
    </div>
  )
}
