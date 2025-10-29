'use client';

import {
  ChatsTeardropIcon,
  DotsThreeVerticalIcon,
} from '@phosphor-icons/react/dist/ssr';

export default function Page() {
  return (
    <div className="relative mx-auto my-8 flex max-w-screen-md items-center rounded shadow-xl">
      <div className="-bottom-[20%] -left-[35%] absolute">
        <div className="-rotate-50 ml-52 size-20">
          <img src="/assets/arrow.png" />
        </div>
        <div className="w-full max-w-sm overflow-hidden rounded border bg-[#fefcf6] text-black shadow-sm">
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
        <div className="w-[430px] space-y-1.5 overflow-hidden rounded border bg-[#fefcf6] p-4 text-black shadow-sm">
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

function _Arrow() {
  return (
    <svg
      fill="none"
      height="50"
      viewBox="0 0 140 97"
      width="140"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_3_238)">
        <path
          d="M0 84.567c.422-3.597.211-7.194 1.055-10.58 1.266-4.866 2.955-9.733 5.487-14.177C21.947 32.303 44.317 11.99 74.494 3.527c30.811-8.464 59.933-1.693 84.202 20.313 12.24 11.002 21.525 24.333 28.7 39.144 1.267 2.751 2.533 5.29 4.854 9.734 2.743-6.136 4.854-10.792 6.964-15.658.633.211 1.266.211 2.11.423.211 1.481.845 2.962.634 4.443-.634 7.406-1.478 14.812-2.322 22.218-.633 4.866-1.055 9.945-6.331 12.06-5.487 2.328-10.129-.846-13.717-4.443-4.854-5.078-9.285-10.791-13.506-16.504-.844-1.27 0-3.597 0-5.502 1.899 0 4.221-.634 5.487.212 3.799 2.75 6.964 6.136 10.552 9.522.211-.635.633-1.058.422-1.27-16.461-46.55-50.226-74.27-98.341-69.403-2.322.212-4.643.635-6.964 1.482C44.95 20.666 21.103 40.767 6.542 71.66c-1.9 4.02-2.743 8.675-4.01 13.118-.844 0-1.688-.211-2.532-.211"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="clip0_3_238">
          <path d="M0 0h202v97H0z" fill="currentColor" />
        </clipPath>
      </defs>
    </svg>
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
