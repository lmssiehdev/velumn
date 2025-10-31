import {
  ArrowUpRightIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CheckFatIcon,
  CheckIcon,
  DotOutlineIcon,
  ListChecksIcon,
  PlusIcon,
} from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Twemoji } from '@/components/markdown/emoji';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Velumn - Make Your Discord Discussions Discoverable',
};

export default function Home() {
  return (
    <>
      <div className="border-neutral-300 border-x border-b">
        <div className="mx-auto max-w-screen-xl border-neutral-300 border-x p-2 px-4 flex items-center justify-between">
          <Link className="text-black text-xl" href="/">
            Velumn
          </Link>
          <a target="_blank" href="https://github.com/lmssiehdev/velumn" className={buttonVariants({ size: "sm", variant: "outline" })}>
            <Twemoji name='⭐' className='size-4.5' />
            <span>Star us on GitHub</span>
          </a>
        </div>
      </div >
      <div className="mx-auto max-w-screen-xl border-neutral-300 border-x p-1">
        <header className="my-20 md:my-40 px-4 text-center">
          <h1 className="mb-6 md:mb-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
            The community platform{" "}
            <br className="hidden sm:block" />
            built for Discord
          </h1>
          <p className="mx-auto max-w-lg text-base sm:text-lg text-neutral-600 px-4">
            Turn Discord community into an SEO-optimized forum.{" "}
            <br className="hidden sm:block" />
            Get discovered on Google, grow your community.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8 md:mt-10 px-4">
            <Button size={'lg'} variant={'default'}>
              Get Started
            </Button>
            <Button size={'lg'} variant={'outline'}>
              <ArrowUpRightIcon className="inline-block h-4 w-4" />
              Check the demo
            </Button>
          </div>
          {/* // TODO: Join number+ creators, and new-age startups */}
        </header>
        <section className="my-40 md:my-32 border-neutral-300 border-t px-4">
          <div className="mx-auto max-w-7xl">
            <div className="space-y-3 py-24 md:py-30 text-center">
              <span className="text-lg text-neutral-600">Why choose?</span>
              <h2 className="font-semibold text-3xl md:text-4xl max-w-3xl mx-auto">
                All the benefits of Discord, without any of the downsides
              </h2>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8'>
              <div className='p-6 md:p-8 bg-neutral-50 rounded border'>
                <div className='flex gap-3 items-center mb-6'>
                  <Twemoji name='😫' className='size-8 flex-shrink-0' />
                  <h3 className='text-2xl md:text-3xl font-bold tracking-tight'>
                    Traditional Forums
                  </h3>
                </div>
                <ul className='flex flex-col gap-6 text-lg md:text-xl text-neutral-700'>
                  <li className='flex items-start gap-3'>
                    <DotOutlineIcon weight='fill' className='size-6 flex-shrink-0 mt-1 text-neutral-400' />
                    <span>Build a separate community (2x the work!)</span>
                  </li>
                  <li className='flex items-start gap-3'>
                    <DotOutlineIcon weight='fill' className='size-6 flex-shrink-0 mt-1 text-neutral-400' />
                    <span>Manage logins, moderation, spam... twice</span>
                  </li>
                  <li className='flex items-start gap-3'>
                    <DotOutlineIcon weight='fill' className='size-6 flex-shrink-0 mt-1 text-neutral-400' />
                    <span>Watch your community split in half</span>
                  </li>
                  <li className='flex items-start gap-3'>
                    <DotOutlineIcon weight='fill' className='size-6 flex-shrink-0 mt-1 text-neutral-400' />
                    <span>Place bets on which dies first</span>
                  </li>
                </ul>
              </div>
              <div className='p-6 md:p-8 bg-purple-50 border-4 border-purple-600 shadow-lg rounded'>
                <div className='flex gap-3 items-center mb-6'>
                  <Twemoji name='✨' className='size-8 flex-shrink-0' />
                  <h3 className='text-2xl md:text-3xl font-bold tracking-tight'>
                    With Velumn
                  </h3>
                </div>
                <ul className='flex flex-col gap-6 text-lg md:text-xl'>
                  <li className='flex items-start gap-3'>
                    <CheckFatIcon className='size-6 flex-shrink-0 mt-1 text-purple-600' />
                    <span>Discord → forum automagically</span>
                  </li>
                  <li className='flex items-start gap-3'>
                    <CheckFatIcon className='size-6 flex-shrink-0 mt-1 text-purple-600' />
                    <span>Zero extra work (seriously, none)</span>
                  </li>
                  <li className='flex items-start gap-3'>
                    <CheckFatIcon className='size-6 flex-shrink-0 mt-1 text-purple-600' />
                    <span>One community, everywhere it needs to be</span>
                  </li>
                  <li className='flex items-start gap-3'>
                    <CheckFatIcon className='size-6 flex-shrink-0 mt-1 text-purple-600' />
                    <span>Live in minutes, not months</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
        <section className="my-40 border-neutral-300 border-t px-4">
          <div className="mx-auto max-w-screen-lg">
            <div className="space-y-2 py-40 text-center">
              <span className="text-lg">How it works</span>
              <h2 className="font-semibold text-4xl">
                Set up your forum in 3 Easy Steps
              </h2>
            </div>
            <div className="grid grid-flow-row grid-rows-3 justify-between gap-14 sm:grid-flow-col sm:grid-cols-3 sm:grid-rows-1 sm:gap-4">
              <div>
                <div className="mb-4 flex size-14 items-center justify-center rounded bg-blue-100">
                  <PlusIcon className="size-8 text-blue-600" />
                </div>
                <span className="text-neutral-600 text-sm">Step 1</span>
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="mb-1 font-medium text-2xl">
                      Add bot to your server
                    </h3>
                    <p className="text-neutral-600">
                      Sign in to get your unique invite link and add our bot to
                      your Discord server with just one click.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-4 flex size-14 items-center justify-center rounded bg-green-100">
                  <ListChecksIcon className="size-8 text-green-600" />
                </div>
                <span className="text-neutral-600 text-sm">Step 2</span>
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="mb-1 font-medium text-2xl">
                      Choose channels to index
                    </h3>
                    <p className="text-neutral-600">
                      Select which channels you want indexed. We'll crawl them
                      and index all threads.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-4 flex size-14 items-center justify-center rounded bg-purple-100">
                  <CheckCircleIcon className="size-6 text-purple-600" />
                </div>
                <span className="text-neutral-600 text-sm">Step 3</span>
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="mb-1 font-medium text-2xl">That's it!</h3>
                    <p className="text-neutral-600">
                      We'll start indexing immediately and email you when your
                      forum is live and searchable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <FAQ />
        <BottomCTA />
      </div>
      <footer className="border-neutral-300 border-t">
        <div className="mx-auto max-w-screen-xl border-x px-4 py-6 text-center">
          <p className="text-neutral-600 text-sm">
            Built with <Twemoji className='inline size-4.5' name='💜' /> and way too many Discord servers
            .{" "}
            <a
              href="https://github.com/lmssiehdev/velumn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-900 hover:text-neutral-600 underline transition-colors"
            >
              Open source on GitHub ↗
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}

export function FAQ() {
  return (
    <section className="border-neutral-300 border-t">
      <div className="mx-auto block max-w-[74rem] grid-cols-3 py-60 md:grid">
        <div className="w-full space-y-2 p-8 font-bold text-4xl">
          <div>Got questions?</div>
          <div className="text-neutral-500">We’ve got answers.</div>
        </div>
        <div className="prose col-span-2 mx-auto w-full max-w-full space-y-4 p-4 [*_p]:max-w-full">
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              How does Velumn work?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-2 pb-4">
              <div>
                Velumn crawls your Discord server and indexes threads in
                channels you specify, turning them into beautifully designed,
                well-optimized, SEO-friendly pages.
              </div>

              <div>
                You keep doing what you do best building community on Discord
                while Velumn makes those conversations discoverable on the web.
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              What sets Velumn apart from other forum solutions?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-2 pb-4">
              <p>
                Velumn is the right choice if you already have or are planning
                to build a community on Discord. With Velumn, you get all the
                advantages of a traditional forum without splitting your focus
                between two different platforms or dealing with the hassle of
                managing your own infrastructure.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              Can I use Velumn for free?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-2 pb-4">
              <p>
                To keep spam low while ensuring we maintain high-quality support
                as we actively develop the product, we currently only offer free
                tiers for non-commercial open source projects and other
                non-profit communities. [Contact us here for more info]
              </p>

              <p>In the future, we plan to offer a free tier.</p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              How does Velumn handle privacy?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-2 pb-4">
              <div className="max-w-full">
                Velumn goes to great lengths to ensure your community stays
                private when needed. We do not sync avatars or Discord tags we
                only sync display names. Users also have the option to anonymize
                their display names using the{' '}
                <pre className="inline rounded bg-neutral-200 p-0.5! text-black">
                  /anonymize
                </pre>{' '}
                command.
              </div>

              <p>
                We're actively working on making this even better. If you have
                any suggestions, please let us know.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              Is there a limit on members?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-2 pb-4">
              <p>No. We have a flat fee for servers of all sizes.</p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </section>
  );
}

function BottomCTA() {
  return (
    <section className="border-neutral-300 border-t">
      <div className="mx-auto my-40 max-w-screen-lg space-y-6 rounded border bg-white py-40 text-center">
        <h3 className="font-bold text-4xl leading-tight">
          Ready to make your Discord searchable?
        </h3>
        <p className="text-neutral-600">
          Try Velumn free for 7 days. No credit card required.
        </p>
        <Button size={'lg'} variant={'default'}>
          Start Free Trial
        </Button>
      </div>
    </section>
  );
}
