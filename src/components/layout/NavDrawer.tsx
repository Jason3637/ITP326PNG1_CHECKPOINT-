"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn, focusRing } from "@/lib/utils";

// Below lg a workspace sidebar becomes this: a menu button in the header
// that opens the same nav in a panel from the left. A native modal <dialog>,
// so the browser traps focus, closes it on Escape, makes the page behind
// inert and returns focus to the button. Following any link inside closes
// it too - even one to the page already open, which doesn't change the path.
export function NavDrawer({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  // Closes on navigation however it happened (a link here, back/forward).
  useEffect(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Open menu"
        aria-haspopup="dialog"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 lg:hidden",
          focusRing,
        )}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Menu"
        // Clicking the backdrop (the dialog element itself, outside the
        // panel) or a link in the panel closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).closest("a")) close();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-white p-0 shadow-xl backdrop:bg-neutral-900/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 pl-6 pr-3">
            <Logo size="sm" />
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                focusRing,
              )}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </dialog>
    </>
  );
}
