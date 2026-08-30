import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

export function DiscordIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className ?? "size-[2.3125rem]"}
      fill="none"
      viewBox="0 0 32 32"
      {...props}
    >
      <path
        d="M11.213 18.856c.322.246.713.392 1.133.392 1.105 0 1.96-.974 1.978-2.173.02-1.198-.869-2.181-1.982-2.181-1.114 0-1.979.983-1.979 2.181 0 .736.338 1.388.85 1.78M17.676 17.075c0 1.2.892 2.173 1.978 2.173 1.106 0 1.96-.974 1.979-2.173.02-1.198-.863-2.181-1.979-2.181-1.113 0-1.978.983-1.978 2.181"
        fill="currentColor"
      />
      <path
        clipRule="evenodd"
        d="M16 32c8.836 0 16-7.163 16-16S24.836 0 16 0 0 7.163 0 16s7.164 16 16 16m3.098-24c1.566.263 3.093.727 4.539 1.382 2.49 3.602 3.726 7.666 3.27 12.354a18.3 18.3 0 0 1-5.571 2.764 13 13 0 0 1-1.191-1.9q.979-.364 1.88-.89a7 7 0 0 1-.46-.342c-1.74.81-3.641 1.23-5.565 1.23s-3.824-.42-5.565-1.23q-.222.171-.46.343a11.7 11.7 0 0 0 1.877.887q-.513 1-1.192 1.902a18.4 18.4 0 0 1-5.566-2.766c-.39-4.043.388-8.143 3.261-12.348A18.5 18.5 0 0 1 12.896 8q.323.57.582 1.17a17 17 0 0 1 5.038 0A12 12 0 0 1 19.098 8"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
}

export function HashIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export function ForumIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="M5 5.5h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-4 3v-3.5a3 3 0 0 1-2-2.8V8.5a3 3 0 0 1 2-3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8 9h6M8 12h4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

export function ChatIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="M5 5h14v11H9l-4 3V5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function ChevronRightIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export function ThreadIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="M12 2.81a1 1 0 0 1 0-1.41l.36-.36a1 1 0 0 1 1.41 0l9.2 9.2a1 1 0 0 1 0 1.4l-.7.7a1 1 0 0 1-1.3.13l-9.54-6.72a1 1 0 0 1-.08-1.58l1-1L12 2.8Zm0 18.39a1 1 0 0 1 0 1.41l-.35.35a1 1 0 0 1-1.41 0l-9.2-9.19a1 1 0 0 1 0-1.41l.7-.7a1 1 0 0 1 1.3-.12l9.54 6.72a1 1 0 0 1 .07 1.58l-1 1zm3.66-4.4a1 1 0 0 1-1.38.28l-8.49-5.66A1 1 0 1 1 6.9 9.76l8.49 5.65a1 1 0 0 1 .27 1.39m1.44-2.55a1 1 0 1 0 1.11-1.66L9.73 6.93a1 1 0 0 0-1.11 1.66l8.49 5.66Z"
        fill="currentColor"
      />
    </svg>
  )
}
