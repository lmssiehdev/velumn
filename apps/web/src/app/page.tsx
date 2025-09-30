import { Button } from "@/components/ui/button";
import { CheckCircleIcon, CheckIcon, PlusIcon, SlidersIcon } from "@phosphor-icons/react/dist/ssr";

export default function Home() {
  return (
    <>
      <div className="max-w-screen-xl p-1 mx-auto border-x border-neutral-300">
        <header className="my-50 text-center ">
          <h1 className="text-7xl mb-8 font-bold">From discord to forum</h1>
          <p className="text-neutral-600 max-w-lg w-full text-wrap mx-auto">
            Convert your Discord community into a clean, fast, SEO-optimized forum in under 60 seconds.

          </p>
          <Button variant={"default"} size={"lg"} className="mt-10">
            Get Started
          </Button>
          {/* // TODO: Join number+ creators, and new-age startups */}
        </header>
        <section className="my-80 border-t border-neutral-300">
          <div className="max-w-screen-lg mx-auto">
            <div className="py-40 text-center space-y-2">
              <span className="text-lg">How it works</span>
              <h2 className="text-4xl font-semibold">Setup up your forum in 3 Easy Steps</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 justify-between ">
              <div className="">
                <div className="mb-4 size-14 bg-blue-100 rounded flex items-center justify-center">
                  <PlusIcon className="size-6 text-blue-600" />
                </div>
                <span className="text-sm text-neutral-600">Step 1</span>
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="font-medium mb-1 text-2xl">Add bot to your server</h3>
                    <p className="text-neutral-600">
                      Sign in to get your unique invite link and add our bot to your Discord server with just one click.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-4 size-14 bg-green-100 rounded  flex items-center justify-center">
                  <SlidersIcon className="size-6 text-green-600" />
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
                      We'll start indexing immediately. Processing typically takes up to 24 hours, and we'll email you when complete.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </section>
        <section className="my-80 border-t border-neutral-300">
          <div className="py-40 max-w-screen-lg mx-auto">
            <div className="pb-40 text-center space-y-2">
              <span className="text-lg">All batteries included</span>
              <h2 className="text-4xl font-semibold">Why use Velumn with Discord for creating your Forum?</h2>
            </div>
            <div className="space-y-30">
              <div className="flex gap-20 flex-row-reverse">
                <div className="flex-1 rounded overflow-hidden shadow">
                  <img src="https://feather.so/images/landing/features/seo-optimized.png" alt="seo optimized" className="w-full" />
                </div>
                <div className="flex-1 py-4 space-y-6">
                  <h3 className="text-4xl font-bold">Your discussions lives in Discord</h3>
                  <div className="space-y-6 text-neutral-600">
                    <div>
                      Your users and moderators love Discord, and you don't need to change that. Velumn seamlessly works alongside Discord to turn discussions into SEO-friendly disovarablle content. so you can take advantage of the community and moderation features of discord without any of the downsides.
                    </div>
                    <ul className="space-y-4 ">
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>All proper tags setup for you.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Serving static pages to make them super fast</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex gap-20">
                <div className="flex-1 rounded overflow-hidden shadow">
                  <img src="https://feather.so/images/landing/features/seo-optimized.png" alt="seo optimized" className="w-full" />
                </div>
                <div className="flex-1 py-4 space-y-6">
                  <h3 className="text-4xl font-bold">Optimized for SEO</h3>
                  <div className="space-y-6 text-neutral-600">
                    <div>
                      You've poured your heart into building this amazing Discord community, but Google? It can't see any of it. We help you Selectivly index helpful discussions, build brand awarness, and show potential users how engaged you are with the community.
                    </div>
                    <ul className="space-y-4 ">
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>All proper tags setup for you.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Serving static pages to make them super fast</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Appear on the Discussions and forums section on google</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Mobile first responsive design</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex flex-row-reverse gap-20">
                <div className="flex-1 rounded overflow-hidden shadow">
                  <img src="/assets/landing/ss-01.png" alt="discoverable" className="w-full object-cover" />
                </div>
                <div className="flex-1 py-4 space-y-6">
                  <h3 className="text-4xl font-bold">Reduced Repetitive Questions</h3>
                  <div className="space-y-6 text-neutral-600">
                    <div>
                      How many times have you watched the same question pop up across different channels? Discord's search makes it nearly impossible to find buried answers, so people just ask again. We make existing solutions actually findable, Your support team will love us.
                    </div>
                    <ul className="space-y-4 ">
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Easily share discussion with non discord users.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon className="size-6" />
                        <span>Links look good on social media.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <footer className="border-t border-neutral-300">
        <div className=" border-x max-w-screen-xl mx-auto py-2 px-4">
          Footer ":)"
        </div>
      </footer>
    </>
  );
}
