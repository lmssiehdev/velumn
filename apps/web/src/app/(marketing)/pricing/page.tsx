import {
  CheckIcon,
  LightningIcon,
  LockIcon,
  TrendUpIcon,
} from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { FAQ } from '@/app/page';
import { Button } from '@/components/ui/button';

export default function PricingPage() {
  return (
    <>
      <div className="border-neutral-300 border-x border-b">
        <div className="mx-auto max-w-screen-xl border-neutral-300 border-x p-2 px-4">
          <Link className="text-black text-xl" href="/">
            Velumn
          </Link>
        </div>
      </div>
      <section className="mx-auto max-w-screen-xl space-y-10 border-neutral-200 border-x px-4 py-20 text-center">
        <div>
          <h1 className="mb-2 font-bold text-3xl leading-tight">
            One plan. Everything included.
          </h1>
          <p className="text-neutral-600">Try us for free — for 7 days.</p>
        </div>
        <div className="mx-auto w-full max-w-sm space-y-10 rounded border border-neutral-200 p-12 shadow-xs">
          <div>
            <div className="font-bold text-2xl">$89/month</div>
            <p className="text-neutral-600">
              Everything you need to make your Discord discoverable
            </p>
          </div>
          <div className="space-y-4">
            {[
              'Connect your own domain',
              'Sub-path hosting (ie. /community)',
              'Unlimited indexed channels',
              'Unlimited page views',
              'Priority support',
            ].map((feature) => {
              return (
                <div className="flex items-center gap-4" key={feature}>
                  <CheckIcon className="size-6 rounded-full border-purple-700 bg-purple-100 p-1 text-purple-700" />
                  <span className="text-neutral-600">{feature}</span>
                </div>
              );
            })}
          </div>
          <Button size={'lg'}>Start Free Trial</Button>
        </div>
      </section>

      <section className="border-neutral-300 border-t">
        <div className="mx-auto max-w-screen-xl border-x px-4 py-60">
          <div className="mx-auto grid max-w-screen-lg grid-cols-1 justify-between md:grid-cols-3 md:gap-12">
            <div className="group flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 transition-colors group-hover:bg-blue-200">
                <LightningIcon className="rounded text-3xl text-blue-600" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900 text-xl">
                Set up in minutes
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Connect Discord, pick your channels, and get your first pages
                live. No complex setup or configuration needed.
              </p>
            </div>

            <div className="group flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-green-100 transition-colors group-hover:bg-green-200">
                <TrendUpIcon className="rounded text-3xl text-green-600" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900 text-xl">
                Built for growth
              </h3>
              <p className="text-gray-600 leading-relaxed">
                No per-user fees. No channel limits. Your price stays the same
                as your community grows.
              </p>
            </div>

            <div className="group flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 transition-colors group-hover:bg-purple-200">
                <LockIcon className="rounded text-3xl text-purple-600" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900 text-xl">
                Privacy first
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Full control over what's public. Choose exactly which channels
                get indexed and keep sensitive discussions private.
              </p>
            </div>
          </div>
        </div>
      </section>
      <FAQ />
    </>
  );
}
