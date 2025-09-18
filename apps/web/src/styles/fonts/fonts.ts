import { Funnel_Sans } from 'next/font/google';
import localFont from 'next/font/local';

export const funnelSans = Funnel_Sans({
  subsets: ['latin'],
  variable: '--font-funnel-sans',
});

export const satoshi = localFont({
  variable: '--font-satoshi',
  src: [
    {
      path: './Satoshi-Regular.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './Satoshi-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
});
