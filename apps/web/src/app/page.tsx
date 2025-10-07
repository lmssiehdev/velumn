import { Button } from "@/components/ui/button";
import {
  CaretDownIcon,
  CheckCircleIcon,
  CheckIcon,
  ListChecksIcon,
  PlusIcon,
  SlidersIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Link from "next/link";

export const metadata = {
  title: "Velumn - Make Your Discord Discussions Discoverable",
};

export default function Home() {
  return (
    <>
      <div className="border-b border-x border-neutral-300">
        <div className="max-w-screen-xl border-x border-neutral-300 mx-auto p-2 px-4">
          <Link href="/" className="text-xl text-black">
            Velumn
          </Link>
        </div>
      </div>
      <div className="max-w-screen-xl p-1 mx-auto border-x border-neutral-300">
        <header className="my-50 text-center ">
          <h1 className="text-7xl mb-8 font-bold leading-tight">From Discord to forum</h1>
          <p className="text-neutral-600 max-w-lg w-full text-wrap mx-auto">
            Convert your Discord community into a clean, fast, SEO-optimized forum in under 60
            seconds.
          </p>
          <Button variant={"default"} size={"lg"} className="mt-10">
            Get Started
          </Button>
          {/* // TODO: Join number+ creators, and new-age startups */}
        </header>
        <section className="my-80 border-t border-neutral-300 px-2">
          <div className="max-w-screen-lg mx-auto">
            <div className="py-40 text-center space-y-2">
              <span className="text-lg">How it works</span>
              <h2 className="text-4xl font-semibold">Set up your forum in 3 Easy Steps</h2>
            </div>
            <div className="grid grid-flow-row grid-rows-3 sm:grid-flow-col sm:grid-cols-3 sm:grid-rows-1 gap-14 sm:gap-4 justify-between">
              <div className="">
                <div className="mb-4 size-14 bg-blue-100 rounded flex items-center justify-center">
                  <PlusIcon className="size-8 text-blue-600" />
                </div>
                <span className="text-sm text-neutral-600">Step 1</span>
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="font-medium mb-1 text-2xl">Add bot to your server</h3>
                    <p className="text-neutral-600">
                      Sign in to get your unique invite link and add our bot to your Discord server
                      with just one click.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-4 size-14 bg-green-100 rounded  flex items-center justify-center">
                  <ListChecksIcon className="size-8 text-green-600" />
                </div>
                <span className="text-sm text-neutral-600">Step 2</span>
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="font-medium mb-1 text-2xl">Choose channels to index</h3>
                    <p className="text-neutral-600">
                      Select which channelsyou want indexed. We'll crawl them and index all threads.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-4 size-14 bg-purple-100 rounded flex items-center justify-center">
                  <CheckCircleIcon className="size-6 text-purple-600" />
                </div>
                <span className="text-sm text-neutral-600">Step 3</span>
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="font-medium mb-1 text-2xl">That's it!</h3>
                    <p className="text-neutral-600">
                      We'll start indexing immediately and email you when your forum is live and
                      searchable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="my-80 border-t border-neutral-300 px-2">
          <div className="max-w-screen-md mx-auto">
            <div className="py-40 text-center space-y-2">
              <span className="text-lg">All batteries included</span>
              <h2 className="text-4xl font-semibold">
                Why use Velumn with Discord for creating your Forum?
              </h2>
            </div>
            <div className="space-y-30">
              <div className="flex gap-20 flex-row-reverse">
                <div className="flex-1 py-4 space-y-6">
                  <h3 className="text-4xl font-bold">Your discussions lives in Discord</h3>
                  <div className="space-y-8 text-neutral-600">
                    <div>
                      Your users and moderators love Discord, and you don't need to change that.
                      Velumn seamlessly works alongside Discord to turn discussions into
                      SEO-friendly, discoverable content so you can take advantage of the community
                      and moderation features of Discord without any of the downsides.
                    </div>
                    <ul className="space-y-4 ">
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Zero changes to your Discord server or workflow.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Thinking of something else to fit here.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex gap-20">
                <div className="flex-1 py-4 space-y-6">
                  <h3 className="text-4xl font-bold">Optimized for SEO</h3>
                  <div className="space-y-6 text-neutral-600">
                    <div>
                      You've poured your heart into building this amazing Discord community, but
                      Google? It can't see any of it. We help you selectively index helpful
                      discussions, build brand awareness, and show potential users how engaged you
                      are with the community.
                    </div>
                    <ul className="space-y-4 ">
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>
                          Automatic SEO optimization with proper meta tags and schema markup
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Lightning-fast static pages that rank higher and load instantly</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Show up in Google's Discussions and Forums section</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Mobile optimized design that works everywhere</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex flex-row-reverse gap-20">
                <div className="flex-1 py-4 space-y-6">
                  <h3 className="text-4xl font-bold">Reduced Repetitive Questions</h3>
                  <div className="space-y-6 text-neutral-600">
                    <div>
                      How many times have you watched the same question pop up across different
                      channels? Discord's search makes it nearly impossible to find buried answers,
                      so people just ask again. We make existing solutions actually findable. Your
                      support team will love us.
                    </div>
                    <ul className="space-y-4 ">
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Easily share discussion with non Discord users.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>
                          Beautiful link previews that drive clicks on Twitter, LinkedIn, and Slack
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <FAQ />
        <BottomCTA />
      </div>
      <footer className="border-t border-neutral-300">
        <div className=" border-x max-w-screen-xl mx-auto py-2 px-4">Footer ":)"</div>
      </footer>
    </>
  );
}

export function FAQ() {
  return (
    <section className=" border-t border-neutral-300">
      <div className="block md:grid grid-cols-3 py-60 max-w-[74rem]  mx-auto">
        <div className="text-4xl font-bold space-y-2 p-8 w-full">
          <div>Got questions?</div>
          <div className="text-neutral-500">We’ve got answers.</div>
        </div>
        <div className="w-full mx-auto space-y-4 prose [*_p]:max-w-full max-w-full p-4  col-span-2">
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              How does Velumn work?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-2 ">
              <>
                <div>
                  Velumn crawls your Discord server and indexes threads in channels you specify,
                  turning them into beautifully designed, well-optimized, SEO-friendly pages.
                </div>

                <div>
                  You keep doing what you do best building community on Discord while Velumn makes
                  those conversations discoverable on the web.
                </div>
              </>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              What sets Velumn apart from other forum solutions?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-2">
              <p>
                Velumn is the right choice if you already have or are planning to build a community
                on Discord. With Velumn, you get all the advantages of a traditional forum without
                splitting your focus between two different platforms or dealing with the hassle of
                managing your own infrastructure.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              Can I use Velumn for free?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-2">
              <p>
                To keep spam low while ensuring we maintain high-quality support as we actively
                develop the product, we currently only offer free tiers for non-commercial open
                source projects and other non-profit communities. [Contact us here for more info]
              </p>

              <p>In the future, we plan to offer a free tier.</p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              How does Velumn handle privacy?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-2">
              <div className="max-w-full">
                Velumn goes to great lengths to ensure your community stays private when needed. We
                do not sync avatars or Discord tags we only sync display names. Users also have the
                option to anonymize their display names using the{" "}
                <pre className="p-0.5! inline bg-neutral-200 text-black rounded">/anonymize</pre>{" "}
                command.
              </div>

              <p>
                We're actively working on making this even better. If you have any suggestions,
                please let us know.
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
              Is there a limit on members?
              <CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-2">
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
    <section className=" border-t border-neutral-300">
      <div className="bg-white rounded border py-40 my-40 space-y-6 text-center max-w-screen-lg  mx-auto">
        <h3 className="text-4xl font-bold leading-tight ">
          Ready to make your Discord searchable?
        </h3>
        <p className="text-neutral-600 ">Try Velumn free for 7 days. No credit card required.</p>
        <Button variant={"default"} size={"lg"}>
          Start Free Trial
        </Button>
      </div>
    </section>
  );
}
