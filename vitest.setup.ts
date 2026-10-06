import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library's automatic post-test cleanup only registers itself
// when it detects a *global* afterEach (e.g. via `test.globals: true`).
// This project keeps globals off (explicit imports, matching Next's own
// Vitest guide), so cleanup is wired up explicitly here instead — without
// it, DOM nodes from one test leak into the next within the same file.
afterEach(() => {
  cleanup();
});

// jsdom has <dialog> but none of its behaviour. Enough of it for the
// modal dialogs here (ui/Dialog, the admin nav drawer): open/close toggle
// the `open` attribute, and close() fires "close" as a browser does.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
