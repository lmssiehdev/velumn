"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";


export function Spoiler({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return <span onClick={() => setIsOpen(true)} draggable="false" className={cn(
    'not-prose inline-block px-1 leading-[22px] select-none transition-all rounded border border-neutral-300 not-prose w-fit',
    {
      'cursor-pointer text-transparent bg-neutral-400 hover:bg-neutral-700': !isOpen,
      'bg-neutral-100': isOpen,
    }
  )}>
    {children}
  </span>
}