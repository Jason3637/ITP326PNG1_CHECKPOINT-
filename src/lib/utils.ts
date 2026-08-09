import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKina(amount: number) {
  return `K${amount.toLocaleString("en-US")}`;
}

// Shared so every plain <Link> (not already styled like a Button) gets the
// same visible keyboard-focus treatment instead of relying on browser defaults.
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";
