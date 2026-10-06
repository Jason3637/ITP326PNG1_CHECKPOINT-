"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/Input";
import { cn, focusRing } from "@/lib/utils";

// A password field with a show/hide toggle. The toggle is a toggle button
// (aria-pressed) with a fixed name, so screen readers announce its state
// rather than a label that changes under the user.
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "trailing">>(
  (props, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        trailing={
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            className={cn(
              "flex h-8 w-9 items-center justify-center rounded-md text-neutral-500 hover:text-neutral-900",
              focusRing,
            )}
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        }
      />
    );
  },
);
PasswordInput.displayName = "PasswordInput";
