import {
  ArrowUpRightIcon,
  CaretDownIcon,
  ChatsTeardropIcon,
  CheckCircleIcon,
  CheckFatIcon,
  DotOutlineIcon,
  DotsThreeVerticalIcon,
  ListChecksIcon,
  PlusIcon,
} from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { Twemoji } from '@/components/markdown/emoji';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Velumn - Make Your Discord Discussions Discoverable',
};

export default function Home() {
  return (
    <>
      <div className="border-neutral-300 border-x border-b">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between border-neutral-300 border-x p-2 px-4">
          <Link className="text-black text-xl" href="/">
            Velumn
          </Link>
          <a
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
            href="https://github.com/lmssiehdev/velumn"
            rel="noopener"
            target="_blank"
          >
            <Twemoji className="size-4.5" name="⭐" />
            <span>Star us on GitHub</span>
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-screen-xl border-neutral-300 border-x p-1">
        <header className="my-20 px-4 text-center md:my-40">
          <h1 className="mb-6 font-bold text-4xl leading-tight sm:text-5xl md:mb-8 md:text-6xl lg:text-7xl">
            The community platform <br className="hidden sm:block" />
            built for Discord
          </h1>
          <p className="mx-auto px-4 text-base text-neutral-600 sm:text-lg">
            Transform your Discord channels into a fully indexed, SEO-optimized forum in minutes.<br />Get discovered on Google, grow your community all without leaving Discord.</p>
          <div className="mt-8 flex flex-col justify-center gap-4 px-4 sm:flex-row md:mt-10">
            <a href='https://dashboard.velumn.com' className={buttonVariants({ size: "lg" })}>
              Get Started
            </a>
            <Button size={'lg'} variant={'outline'}>
              <ArrowUpRightIcon className="inline-block h-4 w-4" />
              Check the demo
            </Button>
          </div>
          {/* // TODO: Join number+ creators, and new-age startups */}
        </header>
        {/* <Preview /> */}
        <section className="my-40 border-neutral-300 border-t px-4 md:my-32">
          <div className="mx-auto max-w-7xl">
            <div className="space-y-3 py-24 text-center md:py-30">
              <span className="text-lg text-neutral-600">Why choose?</span>
              <h2 className="mx-auto max-w-3xl font-semibold text-3xl md:text-4xl">
                All the benefits of Discord, without any of the downsides
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
              <div className="rounded border bg-neutral-50 p-6 md:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <Twemoji className="size-8 flex-shrink-0" name="😫" />
                  <h3 className="font-bold text-2xl tracking-tight md:text-3xl">
                    Traditional Forums
                  </h3>
                </div>
                <ul className="flex flex-col gap-6 text-lg text-neutral-700 md:text-xl">
                  <li className="flex items-start gap-3">
                    <DotOutlineIcon
                      className="mt-1 size-6 flex-shrink-0 text-neutral-400"
                      weight="fill"
                    />
                    <span>Build a separate community (double the work!)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <DotOutlineIcon
                      className="mt-1 size-6 flex-shrink-0 text-neutral-400"
                      weight="fill"
                    />
                    <span>Manage logins, moderation, spam... twice</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <DotOutlineIcon
                      className="mt-1 size-6 flex-shrink-0 text-neutral-400"
                      weight="fill"
                    />
                    <span>Watch your community split in half</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <DotOutlineIcon
                      className="mt-1 size-6 flex-shrink-0 text-neutral-400"
                      weight="fill"
                    />
                    <span>Place bets on which dies first</span>
                  </li>
                </ul>
              </div>
              <div className="rounded border-4 border-purple-600 bg-purple-50 p-6 shadow-lg md:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <Twemoji className="size-8 flex-shrink-0" name="✨" />
                  <h3 className="font-bold text-2xl tracking-tight md:text-3xl">
                    With Velumn
                  </h3>
                </div>
                <ul className="flex flex-col gap-6 text-lg md:text-xl">
                  <li className="flex items-start gap-3">
                    <CheckFatIcon className="mt-1 size-6 flex-shrink-0 text-purple-600" />
                    <span>Discord ⇒ forum automagically</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckFatIcon className="mt-1 size-6 flex-shrink-0 text-purple-600" />
                    <span>Zero extra work (seriously, none)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckFatIcon className="mt-1 size-6 flex-shrink-0 text-purple-600" />
                    <span>One community, everywhere it needs to be</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckFatIcon className="mt-1 size-6 flex-shrink-0 text-purple-600" />
                    <span>Live in minutes, not weeks</span>
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
            Built with <Twemoji className="inline size-4.5" name="💜" /> and way
            too many Discord servers .{' '}
            <a
              className="text-neutral-900 underline transition-colors hover:text-neutral-600"
              href="https://github.com/lmssiehdev/velumn"
              rel="noopener noreferrer"
              target="_blank"
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
                non-profit communities.
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
              <p>No. We index servers of all sizes.</p>
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

export function Preview() {
  return (
    <div className="relative mx-auto my-8 flex max-w-screen-md items-center rounded shadow-xl">
      <div className="-top-[40%] -left-[35%] absolute">
        <div className="w-full max-w-sm overflow-hidden rounded border bg-[#fefcf6] text-black shadow">
          <div className="flex items-center gap-2 border-neutral-200 border-b-1 px-4 pt-4 pb-2">
            <DiscordIcon />
            <span>How do I index discord channels into google?</span>
          </div>
          <div className="space-y-4 p-4">
            <div className="flex gap-3">
              <div className="size-10 rounded-full bg-[#ced1e4]" />
              <div className="flex-1">
                <div className="font-bold text-sm tracking-wider">
                  lmssiehdev
                </div>
                <p>How do I index my discord channels into google?</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="size-10 rounded-full bg-[#ced1e4]" />
              <div className="flex-1">
                <div className="mb-2 h-3 w-10 rounded bg-[#ced1e4]" />
                <div className="h-5 rounded bg-[#ced1e4]" />
              </div>
            </div>
          </div>
        </div>
        <div className="ml-52 size-20 -scale-x-[1] -rotate-120">
          <img src="/assets/arrow.png" />
        </div>
      </div>
      <div className="">
        <img
          className="object-cover"
          src="/assets/landing/ss-demo-preview.png"
        />
      </div>
      <div className="-bottom-[20%] -right-[35%] absolute">
        <div className="ml-33 size-20 rotate-40">
          <img src="/assets/arrow.png" />
        </div>
        <div className="w-[430px] space-y-1.5 overflow-hidden rounded border bg-[#fefcf6] p-4 text-black shadow">
          <div className="mb-2 flex items-center gap-4 p-2">
            <div className="font-bold text-xl">Google</div>
            <div className="w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-[#e7e8f0] px-4 py-1.5">
              How do I index discord channels into google?
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-white">
              <ChatsTeardropIcon className="size-6 text-black" />
            </div>
            <div className="text-sm">
              <div>Velumn</div>
              <div className="align-baseline text-sm">
                https://velumn.com &gt; thread ...{' '}
                <DotsThreeVerticalIcon className="inline-block" weight="bold" />
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-lg">
              How do I index my discord channels into google?
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm">Jun 18, 2023 — </div>
              <div className="h-3 flex-1 rounded bg-[#ced1e4]" />
            </div>
            <div className="mb-1 h-3 flex-1 rounded bg-[#ced1e4]" />
            <div className="mb-1 h-3 flex-1 rounded bg-[#ced1e4]" />
          </div>
        </div>
      </div>
    </div>
  );
}
function DiscordIcon() {
  return (
    <svg
      className="inline-block size-5"
      viewBox="0 0 126.644 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M81.15 0a74 74 0 0 0-3.36 6.794 97.9 97.9 0 0 0-28.994 0A68 68 0 0 0 45.437 0a105.6 105.6 0 0 0-26.14 8.057C2.779 32.53-1.691 56.373.53 79.887a105 105 0 0 0 32.05 16.088 77 77 0 0 0 6.87-11.063c-3.738-1.389-7.35-3.131-10.81-5.152.91-.657 1.794-1.338 2.653-1.995a75.26 75.26 0 0 0 64.075 0c.86.707 1.743 1.389 2.652 1.995a69 69 0 0 1-10.835 5.178A77 77 0 0 0 94.056 96a105 105 0 0 0 32.051-16.063c2.626-27.277-4.496-50.917-18.817-71.855A104 104 0 0 0 81.175.05zM42.28 65.414c-6.238 0-11.416-5.657-11.416-12.653s4.976-12.679 11.391-12.679 11.517 5.708 11.416 12.679c-.101 6.97-5.026 12.653-11.39 12.653m42.078 0c-6.264 0-11.391-5.657-11.391-12.653s4.975-12.679 11.39-12.679S95.85 45.79 95.749 52.761c-.1 6.97-5.026 12.653-11.39 12.653"
        fill="currentColors"
      />
    </svg>
  );
}
