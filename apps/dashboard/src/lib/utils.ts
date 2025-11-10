import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function minDelay<T>(promise: Promise<T>, ms: number) {
  const delay = new Promise((resolve) => setTimeout(resolve, ms));
  const [p] = await Promise.all([promise, delay]);

  return p;
}
