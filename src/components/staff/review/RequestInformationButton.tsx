"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { REQUEST_INFORMATION_OPEN_EVENT } from "@/lib/information-requests";

// Opens the request-more-information dialog (RequestInformationForm) from
// anywhere on the review page - the header, the checklist. When the dialog
// closes, the browser returns focus here.
export function RequestInformationButton({
  variant = "outline",
  size = "sm",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className">) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      aria-haspopup="dialog"
      onClick={() => window.dispatchEvent(new Event(REQUEST_INFORMATION_OPEN_EVENT))}
    >
      <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
      Request more information
    </Button>
  );
}
