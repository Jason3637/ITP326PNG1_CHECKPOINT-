"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

const FULL_LOGO_SRC = "/brand/prime-logo.jpg";

// Cropped, transparent-background version of just the headdress mark (no
// gradient background square) — for compact contexts like a small header
// icon. Not created yet. Once it's added at this path, <Logo variant="mark">
// will pick it up automatically; until then (or if it 404s) it falls back
// to the full logo below.
const MARK_LOGO_SRC = "/brand/prime-logo-mark-only.png";

export interface LogoProps extends Omit<ImageProps, "src" | "alt"> {
  variant?: "full" | "mark";
  alt?: string;
}

export function Logo({ variant = "full", alt = "Prime's Vault", className, ...props }: LogoProps) {
  const [markMissing, setMarkMissing] = useState(false);
  const useMark = variant === "mark" && !markMissing;

  return (
    <Image
      src={useMark ? MARK_LOGO_SRC : FULL_LOGO_SRC}
      alt={alt}
      className={cn("object-contain", className)}
      onError={useMark ? () => setMarkMissing(true) : undefined}
      {...props}
    />
  );
}
