import { Outlet, createFileRoute } from "@tanstack/react-router"

import questrialUrl from "../../../../web/assets/Questrial-Regular.ttf?url"
import { CommunitySearch } from "@/features/public-search/community-search"
import searchCss from "@/features/public-search/public-search.css?url"
import threadCss from "@/features/public-thread/public-thread.css?url"
import {
  TenantRouteError,
  TenantRouteNotFound,
} from "@/features/tenant-routing/components"
import { getTenantCanonicalOrigin } from "@/features/tenant-routing/functions"
import tenantCss from "@/features/tenant-routing/tenant-forum.css?url"

export const Route = createFileRoute("/__tenant/$host")({
  loader: ({ params }) =>
    getTenantCanonicalOrigin({ data: { hostname: params.host } }),
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  headers: () => ({ "Cache-Control": "no-store" }),
  head: () => ({
    links: [
      { rel: "stylesheet", href: tenantCss },
      { rel: "stylesheet", href: threadCss },
      { rel: "stylesheet", href: searchCss },
    ],
  }),
  component: TenantLayout,
  errorComponent: TenantRouteError,
  notFoundComponent: TenantRouteNotFound,
})

function TenantLayout() {
  return (
    <div className="tenant-shell">
      <style>{`@font-face{font-family:"Questrial";src:url("${questrialUrl}") format("truetype");font-style:normal;font-weight:400;font-display:swap}`}</style>
      <a className="tenant-skip" href="#main-content">
        Skip to content
      </a>
      <header className="tenant-header">
        <div className="tenant-header-inner">
          <a className="tenant-brand" href="/">
            Velumn
          </a>
          <CommunitySearch />
        </div>
      </header>
      <div className="tenant-shell-main">
        <Outlet />
      </div>
      <footer className="tenant-footer">
        <div className="tenant-footer-inner">Powered by Velumn</div>
      </footer>
    </div>
  )
}
