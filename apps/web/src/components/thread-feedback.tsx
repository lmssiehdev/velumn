"use client";
import { useState } from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Twemoji } from './markdown-renderer/markdown-renderer';

export default function ThreadFeedback() {
    const [submitted, setSubmitted] = useState<"yes" | "no" | undefined>();

    return <div className='max-w-sm w-full flex flex-col items-center p-4 mb-20 rounded border border-neutral-300'>
        <p className='p-2'>Did this answer your question?</p>
        <div className='flex gap-5'>
            <Button onClick={() => {
                setSubmitted("yes");
            }} disabled={submitted === "no"} variant={'ghost'} size={"sm"} className={cn('flex gap-2 hover:scale-110', {
                'bg-accent text-accent-foreground scale-110': submitted === "yes"
            })}>
                <Twemoji name="👍" className="size-5" />
                Yes
            </Button>
            <Button onClick={() => {
                setSubmitted("no");
            }}
            disabled={submitted === 'yes'}
            variant={'ghost'}  size={"sm"} className={cn('flex gap-2 hover:scale-110', {
                'bg-accent text-accent-foreground scale-110': submitted === "no"
            })}>
                <Twemoji name="👍" className="size-5" />
                No
            </Button>
        </div>
    </div>
}
