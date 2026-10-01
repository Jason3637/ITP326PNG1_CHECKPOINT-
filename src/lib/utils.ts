import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKina(amount: number) {
  return `K${amount.toLocaleString("en-US")}`;
}

// A plain helper (not a component/hook), so the direct Date.now() call
// here doesn't trip the react-hooks/purity rule the way it would inside a
// component's render body — call this from a Server Component instead of
// calling Date.now() inline there.
export function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// Shared so every plain <Link> (not already styled like a Button) gets the
// same visible keyboard-focus treatment instead of relying on browser defaults.
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";
