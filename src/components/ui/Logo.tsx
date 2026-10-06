"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

const FULL_LOGO_SRC = "/brand/prime-logo.jpg";

// Cropped, transparent-background version of just the headdress mark (no
// gradient background square) — for compact contexts like a small header
// icon. Not supplied yet, so this is null and <Logo variant="mark"> uses the
// full logo. It used to point at the not-yet-existing file and rely on the
// onError fallback, but that made /_next/image return 400 on every page
// (confirmed in the staging walkthrough). Once the asset is added to
// public/brand/, set this to "/brand/prime-logo-mark-only.png"; the onError
// fallback below still covers a bad or missing file after that.
const MARK_LOGO_SRC: string | null = null;

export interface LogoProps extends Omit<ImageProps, "src" | "alt"> {
  variant?: "full" | "mark";
  alt?: string;
}

export function Logo({ variant = "full", alt = "PRIMESTONE", className, ...props }: LogoProps) {
  const [markMissing, setMarkMissing] = useState(false);
  const markSrc = variant === "mark" && !markMissing ? MARK_LOGO_SRC : null;
  const useMark = markSrc !== null;

  return (
    <Image
      src={markSrc ?? FULL_LOGO_SRC}
      alt={alt}
      className={cn("object-contain", className)}
      onError={useMark ? () => setMarkMissing(true) : undefined}
      {...props}
    />
  );
}
