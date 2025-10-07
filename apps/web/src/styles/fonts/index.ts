import { Questrial } from "next/font/google";
import localFont from "next/font/local";

export const questrial = Questrial({
  weight: "400",
  variable: "--font-questrial",
});

export const satoshi = localFont({
  variable: "--font-satoshi",
  src: [
    {
      path: "./Satoshi-Regular.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./Satoshi-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
});
