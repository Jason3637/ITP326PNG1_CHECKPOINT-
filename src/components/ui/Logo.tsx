"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// The brand name is rendered as real text, never baked into an image, so a
// rename is a one-line change here rather than a new asset.
export const BRAND_NAME = "PRIMESTONE";

// The client's logo image, used as the mark by request. It's the full
// flattened logo, so it still has "PRIME" and the old tagline baked in. When
// a cropped, text-free headdress mark is supplied, point this at it instead.
// If the file fails to load (or this is set to null), the mark falls back to
// a monogram.
const MARK_LOGO_SRC: string | null = "/brand/prime-logo.jpg";

export type LogoSize = "sm" | "md" | "lg";

const sizeStyles: Record<
  LogoSize,
  { markPx: number; mark: string; word: string; gap: string; stacked: boolean }
> = {
  // Sidebar
  sm: { markPx: 20, mark: "h-5 w-5 rounded text-[13px]", word: "text-base", gap: "gap-2", stacked: false },
  // App header
  md: { markPx: 28, mark: "h-7 w-7 rounded-md text-lg", word: "text-xl", gap: "gap-2", stacked: false },
  // Login / signup - mark above a large wordmark; one step smaller on phones
  lg: {
    markPx: 96,
    mark: "h-20 w-20 rounded-xl text-[54px] sm:h-24 sm:w-24 sm:text-[64px]",
    word: "text-4xl sm:text-5xl",
    gap: "gap-3",
    stacked: true,
  },
};

export interface LogoProps {
  size?: LogoSize;
  // "full" = mark + wordmark; "mark" = the mark alone (labelled for screen
  // readers, since there's no visible text next to it).
  variant?: "full" | "mark";
  // Optional line under the wordmark, rendered as real text.
  tagline?: string;
  // Preloads the mark image (above-the-fold uses like the login page). No
  // effect while the monogram placeholder is in use.
  preload?: boolean;
  className?: string;
}

export function Logo({ size = "md", variant = "full", tagline, preload, className }: LogoProps) {
  const s = sizeStyles[size];

  if (variant === "mark") {
    return <LogoMark size={size} label={BRAND_NAME} preload={preload} className={className} />;
  }

  return (
    <div
      className={cn(
        "flex",
        s.gap,
        s.stacked ? "flex-col items-center text-center" : "flex-row items-center",
        className,
      )}
    >
      <LogoMark size={size} preload={preload} />
      <div className="flex flex-col">
        <span className={cn("font-display font-extrabold uppercase leading-none tracking-wide text-primary", s.word)}>
          {BRAND_NAME}
        </span>
        {tagline && <span className="font-accent mt-2 text-sm text-neutral-600">{tagline}</span>}
      </div>
    </div>
  );
}

// With `label`, the mark stands alone and is announced; without it, it sits
// next to the visible wordmark and is hidden from screen readers so the name
// isn't read twice.
function LogoMark({
  size,
  label,
  preload,
  className,
}: {
  size: LogoSize;
  label?: string;
  preload?: boolean;
  className?: string;
}) {
  const [markMissing, setMarkMissing] = useState(false);
  const s = sizeStyles[size];

  if (MARK_LOGO_SRC && !markMissing) {
    return (
      <Image
        src={MARK_LOGO_SRC}
        width={s.markPx}
        height={s.markPx}
        alt={label ?? ""}
        preload={preload}
        className={cn("shrink-0 object-contain", s.mark, className)}
        onError={() => setMarkMissing(true)}
      />
    );
  }

  // Interim monogram on the brand gradient, until the cropped mark is delivered.
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn(
        "flex shrink-0 select-none items-center justify-center bg-brand-gradient font-display font-extrabold leading-none text-white",
        s.mark,
        className,
      )}
    >
      {BRAND_NAME[0]}
    </span>
  );
}
