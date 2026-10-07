import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { LoadWhenShown } from "./LoadWhenShown";

describe("LoadWhenShown", () => {
  it("waits while its tab panel is hidden, then refreshes once when it's shown", async () => {
    render(
      <div role="tabpanel" hidden>
        <LoadWhenShown label="Loading the customer's history…" />
      </div>,
    );
    const panel = screen.getByRole("tabpanel", { hidden: true });
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      panel.hidden = false;
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the customer's history…");

    await act(async () => {
      panel.hidden = true;
    });
    await act(async () => {
      panel.hidden = false;
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
