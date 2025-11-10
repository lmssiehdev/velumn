'use client';

import { ChatsTeardropIcon, HashIcon } from '@phosphor-icons/react/dist/ssr';
import type { AuthUserInsert } from '@repo/db/schema/auth';
import type { DBServer } from '@repo/db/schema/discord';
import { GalleryVerticalEnd, HomeIcon } from 'lucide-react';
import type * as React from 'react';
import { NavProjects } from '@/components/nav-projects';
import { NavUser } from '@/components/nav-user';
import { ServersSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';

const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
  ],
  projects: [
    {
      name: 'Home',
      url: '/',
      icon: HomeIcon,
    },
    {
      name: 'Channels',
      url: '/channels',
      icon: HashIcon,
    },
    {
      name: 'Feedback',
      url: '/feedback',
      icon: ChatsTeardropIcon,
    },
  ],
};

export function AppSidebar({
  user,
  servers,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: AuthUserInsert;
  servers: DBServer[];
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <ServersSwitcher servers={servers} />
      </SidebarHeader>
      <SidebarContent>
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
