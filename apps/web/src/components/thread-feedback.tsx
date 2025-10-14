'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Twemoji } from './markdown/emoji';
import { Button } from './ui/button';

export default function ThreadFeedback() {
  const [submitted, setSubmitted] = useState<'yes' | 'no' | undefined>();

  return (
    <div className="mb-20 flex w-full max-w-sm flex-col items-center rounded border border-neutral-300 p-4">
      <p className="p-2">Did this answer your question?</p>
      <div className="flex gap-5">
        <Button
          className={cn('flex gap-2 hover:scale-110', {
            'scale-110 bg-accent text-accent-foreground': submitted === 'yes',
          })}
          disabled={submitted === 'no'}
          onClick={() => {
            setSubmitted('yes');
          }}
          size={'sm'}
          variant={'ghost'}
        >
          <Twemoji className="size-5" name="👍" />
          Yes
        </Button>
        <Button
          className={cn('flex gap-2 hover:scale-110', {
            'scale-110 bg-accent text-accent-foreground': submitted === 'no',
          })}
          disabled={submitted === 'yes'}
          onClick={() => {
            setSubmitted('no');
          }}
          size={'sm'}
          variant={'ghost'}
        >
          <Twemoji className="size-5" name="👍" />
          No
        </Button>
      </div>
    </div>
  );
}
