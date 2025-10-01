import { FAQ } from "@/app/page";
import { Button } from "@/components/ui/button";
import { CheckIcon, LightningIcon, LockIcon, RocketIcon, TrendUpIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function PricingPage() {
    return (
      <>
            <div className="border-b border-x border-neutral-300">
                <div className="max-w-screen-xl border-x border-neutral-300 mx-auto p-2 px-4">
                    <Link href="/" className="text-xl text-black">Velumn</Link>
                </div>
            </div>
            <section className="border-x border-neutral-200 max-w-screen-xl mx-auto py-20 px-4 space-y-10 text-center">
                <div>

                    <h1 className="text-3xl mb-2 font-bold leading-tight">
                        One plan. Everything included.
                    </h1>
                    <p className="text-neutral-600">Try us for free — for 7 days.</p>
                </div>
                <div className="max-w-sm w-full mx-auto space-y-10 rounded shadow-xs border border-neutral-200 p-12">
                    <div >
                        <div className="text-2xl font-bold">$89/month</div>
                        <p className="text-neutral-600">Everything you need to make your Discord discoverable</p>
                    </div>
                    <div className="space-y-4">
                        {[
                            "Connect your own domain",
                            "Sub-path hosting (ie. /community)",
                            "Unlimited indexed channels",
                            "Unlimited page views",
                            "Priority support",
                        ].map(feature => {
                            return (
                                <div key={feature} className="flex gap-4 items-center">
                                    <CheckIcon className="size-6 p-1 rounded-full border-purple-700  bg-purple-100 text-purple-700" />
                                    <span className="text-neutral-600">{feature}</span>
                                </div>
                            )
                        })}
                    </div>
                    <Button size={"lg"}>
                        Start Free Trial
                    </Button>
                </div>
            </section>

            <section className="border-t border-neutral-300">
                <div className="border-x px-4 py-60 max-w-screen-xl mx-auto">
                    <div className="max-w-screen-lg  mx-auto grid grid-cols-1 md:grid-cols-3 justify-between md:gap-12">

                        <div className="flex flex-col items-center text-center group">
                            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                                <LightningIcon className="text-3xl text-blue-600 rounded" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Set up in minutes
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                Connect Discord, pick your channels, and get your first pages live. No complex setup or configuration needed.
                            </p>
                        </div>

                        <div className="flex flex-col items-center text-center group">
                            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                                <TrendUpIcon className="text-3xl text-green-600 rounded" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Built for growth
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                No per-user fees. No channel limits. Your price stays the same as your community grows.
                            </p>
                        </div>

                        <div className="flex flex-col items-center text-center group">
                            <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                                <LockIcon className="text-3xl text-purple-600 rounded"></LockIcon>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Privacy first
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                Full control over what's public. Choose exactly which channels get indexed and keep sensitive discussions private.
                            </p>
                        </div>

                    </div>
                </div>
            </section>
            <FAQ />
      </>
    )
}
