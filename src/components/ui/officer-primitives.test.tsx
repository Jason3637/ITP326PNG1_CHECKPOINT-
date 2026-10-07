import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Clock } from "lucide-react";
import { Button, buttonClasses } from "./Button";
import { CompactEmptyState, EmptyState } from "./EmptyState";
import { ImportantPanel, Panel } from "./Panel";
import { ProgressSummary } from "./ProgressSummary";
import { Section } from "./Section";
import { StatusBadge } from "./StatusBadge";
import { Tabs } from "./Tabs";
import { SegmentedControl } from "./SegmentedControl";
import { useState } from "react";

describe("StatusBadge icon (opt-in)", () => {
  it("keeps the dot by default", () => {
    const { container } = render(<StatusBadge status="approved">Approved</StatusBadge>);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("span.rounded-full.bg-success")).not.toBeNull();
  });

  it("shows the tone's icon, hidden from screen readers, with the words", () => {
    const { container } = render(
      <StatusBadge status="rejected" icon>
        Rejected
      </StatusBadge>,
    );
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.getAttribute("class")).toContain("lucide-circle-x");
    expect(screen.getByText("Rejected")).toHaveClass("bg-danger-light");
  });

  it("takes a specific icon", () => {
    const { container } = render(
      <StatusBadge tone="info" icon={Clock}>
        Waiting
      </StatusBadge>,
    );
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("lucide-clock");
  });
});

describe("Button link variant", () => {
  it("reads as text: no box height or padding, but a 24px minimum target", () => {
    const cls = buttonClasses({ variant: "link", size: "sm" });
    expect(cls).toContain("text-primary");
    expect(cls).toContain("min-h-6");
    expect(cls).toContain("text-xs");
    expect(cls).not.toMatch(/\bh-8\b|\bpx-3\b/);
  });

  it("leaves the other variants' classes as they were", () => {
    expect(buttonClasses({ variant: "secondary", size: "sm" })).toContain("h-8 px-3 text-sm");
    expect(buttonClasses()).toContain("h-10 px-4 text-sm");
  });

  it("is still a real button", () => {
    render(<Button variant="link">Add note</Button>);
    expect(screen.getByRole("button", { name: "Add note" })).toHaveAttribute("class", expect.stringContaining("hover:underline"));
  });
});

describe("CompactEmptyState", () => {
  it("is EmptyState's one-line size", () => {
    const { container: compact } = render(<CompactEmptyState title="None">Nothing waiting.</CompactEmptyState>);
    const { container: sm } = render(
      <EmptyState size="sm" title="None">
        Nothing waiting.
      </EmptyState>,
    );
    expect(compact.innerHTML).toBe(sm.innerHTML);
  });
});

describe("Section", () => {
  it("is a section named by its heading, and a link target", () => {
    render(
      <Section id="queues" title="Your queues" description="Oldest first.">
        <p>content</p>
      </Section>,
    );
    const region = screen.getByRole("region", { name: "Your queues" });
    expect(region).toHaveAttribute("id", "queues");
    expect(within(region).getByRole("heading", { level: 2, name: "Your queues" })).toHaveAttribute("id", "queues-heading");
    expect(within(region).getByText("content")).toBeInTheDocument();
  });

  it("can sit under another h2", () => {
    render(
      <Section id="s" title="Sub" as="h3">
        x
      </Section>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Sub" })).toBeInTheDocument();
  });
});

describe("Panel and ImportantPanel", () => {
  it("renders the heading, meta, description, actions, body and footer", () => {
    render(
      <Panel
        id="customer"
        title="Customer"
        as="h3"
        meta={<span>Verified</span>}
        description="From the profile."
        actions={<button type="button">Edit</button>}
        footer={<button type="button">Save</button>}
      >
        <p>body</p>
      </Panel>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Customer" })).toHaveAttribute("id", "customer");
    for (const t of ["Verified", "From the profile.", "body"]) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("leaves out an empty body and footer", () => {
    const { container } = render(<Panel title="Empty" />);
    expect(container.querySelectorAll(".mt-4")).toHaveLength(0);
  });

  it("gives the important panel the emphasis surface and its eyebrow", () => {
    const { container } = render(
      <ImportantPanel title="Start the review" eyebrow="Your next step">
        x
      </ImportantPanel>,
    );
    expect(container.firstElementChild).toHaveClass("border-primary/40", "shadow-md");
    expect(screen.getByText("Your next step")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Start the review" })).toBeInTheDocument();
  });
});

describe("ProgressSummary", () => {
  it("says the progress in words and exposes it as a progress bar", () => {
    render(<ProgressSummary label="Required checks" value={3} total={5} />);
    expect(screen.getByText("3 of 5")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Required checks" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(bar).toHaveAttribute("aria-valuetext", "3 of 5");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("60%");
    expect(bar.firstElementChild).toHaveClass("bg-primary");
  });

  it("turns green when complete, and shows a status badge with an icon", () => {
    const { container } = render(
      <ProgressSummary label="Required checks" value={5} total={5} status={{ tone: "success", label: "All required checks done" }} />,
    );
    expect(screen.getByRole("progressbar").firstElementChild).toHaveClass("bg-success");
    expect(screen.getByText("All required checks done")).toHaveClass("bg-success-light");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("clamps out-of-range values and copes with nothing to do", () => {
    render(<ProgressSummary label="A" value={9} total={4} />);
    expect(screen.getByRole("progressbar", { name: "A" })).toHaveAttribute("aria-valuenow", "4");
    render(<ProgressSummary label="B" value={0} total={0} valueText="Nothing required" />);
    const empty = screen.getByRole("progressbar", { name: "B" });
    expect((empty.firstElementChild as HTMLElement).style.width).toBe("0%");
    expect(screen.getByText("Nothing required")).toBeInTheDocument();
  });

  it("shows detail under the bar", () => {
    render(
      <ProgressSummary label="Required checks" value={1} total={2}>
        Outstanding: Referee checked.
      </ProgressSummary>,
    );
    expect(screen.getByText("Outstanding: Referee checked.")).toBeInTheDocument();
  });
});

describe("Tabs count options (opt-in)", () => {
  const tabs = (extra: object) => [
    { id: "overview", label: "Overview", content: <p>o</p> },
    { id: "verification", label: "Verification", count: 2, ...extra, content: <p>v</p> },
  ];

  it("keeps the plain count by default", () => {
    render(<Tabs label="Details" initialTab="overview" tabs={tabs({})} />);
    const tab = screen.getByRole("tab", { name: /^Verification/ });
    const pill = within(tab).getByText("2");
    expect(pill).toHaveClass("bg-neutral-100");
    expect(pill).not.toHaveAttribute("aria-hidden");
  });

  it("marks outstanding work in amber and says what the count means", () => {
    render(<Tabs label="Details" initialTab="overview" tabs={tabs({ countTone: "attention", countLabel: "outstanding" })} />);
    const tab = screen.getByRole("tab", { name: "Verification, 2 outstanding" });
    const pill = within(tab).getByText("2");
    expect(pill).toHaveClass("bg-warning-light", "text-amber-800");
    expect(pill).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Tabs history modes", () => {
  const tabs = [
    { id: "overview", label: "Overview", content: <p>o</p> },
    {
      id: "verification",
      label: "Verification",
      content: (
        <label>
          Note <input />
        </label>
      ),
    },
    { id: "documents", label: "Documents", content: <p>d</p> },
  ];

  afterEach(() => {
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("push: each switch is a history entry; re-selecting the open tab adds none", async () => {
    window.history.replaceState(null, "", "/staff/applications/8?requested=1");
    const push = vi.spyOn(window.history, "pushState");
    render(<Tabs label="Details" initialTab="overview" history="push" tabs={tabs} />);
    await userEvent.click(screen.getByRole("tab", { name: "Documents" }));
    expect(push).toHaveBeenCalledTimes(1);
    // Other parameters are kept; null state, as Next's docs show.
    expect(push.mock.calls[0][0]).toBeNull();
    expect(String(push.mock.calls[0][2])).toMatch(/\/staff\/applications\/8\?requested=1&tab=documents$/);
    await userEvent.click(screen.getByRole("tab", { name: "Documents" }));
    expect(push).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(String(push.mock.calls[1][2])).toMatch(/\?requested=1$/); // first tab keeps the URL clean
  });

  it("push: Back and Forward show the tab the URL names (unknown -> the first tab)", () => {
    render(<Tabs label="Details" initialTab="overview" history="push" tabs={tabs} />);
    act(() => {
      window.history.replaceState(null, "", "/?tab=documents");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "true");
    act(() => {
      window.history.replaceState(null, "", "/?tab=bogus");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps typed input when switching away and back", async () => {
    render(<Tabs label="Details" initialTab="verification" history="push" tabs={tabs} />);
    await userEvent.type(screen.getByLabelText("Note"), "unsaved draft");
    await userEvent.click(screen.getByRole("tab", { name: "Documents" }));
    await userEvent.click(screen.getByRole("tab", { name: "Verification" }));
    expect(screen.getByLabelText("Note")).toHaveValue("unsaved draft");
  });

  it("replace (the default, used by the admin page): rewrites the entry and ignores popstate", async () => {
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    render(<Tabs label="Details" initialTab="overview" tabs={tabs} />);
    await userEvent.click(screen.getByRole("tab", { name: "Documents" }));
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma" },
  ];

  function Harness({ disabled = false }: { disabled?: boolean }) {
    const [v, setV] = useState("b");
    return <SegmentedControl label="Pick one" options={options} value={v} onChange={setV} disabled={disabled} />;
  }

  it("is a labelled radio group with one tab stop, the checked option marked by a check as well as colour", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Pick one" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => [r.textContent, r.getAttribute("aria-checked"), r.tabIndex])).toEqual([
      ["Alpha", "false", -1],
      ["Beta", "true", 0],
      ["Gamma", "false", -1],
    ]);
    expect(radios[1].querySelector("svg")).not.toBeNull();
    expect(radios[1]).toHaveClass("font-semibold");
    expect(radios[0].querySelector("svg")).toBeNull();
  });

  it("moves and selects with arrows (wrapping), Home and End; clicks select too", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const radio = (name: string) => screen.getByRole("radio", { name });
    radio("Beta").focus();
    await user.keyboard("{ArrowRight}");
    expect(radio("Gamma")).toHaveAttribute("aria-checked", "true");
    expect(radio("Gamma")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(radio("Alpha")).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{End}");
    expect(radio("Gamma")).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Home}");
    expect(radio("Alpha")).toHaveAttribute("aria-checked", "true");
    await user.click(radio("Beta"));
    expect(radio("Beta")).toHaveAttribute("aria-checked", "true");
  });

  it("is 44px tall on touch screens", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveClass("h-8", "pointer-coarse:h-11");
  });

  it("can be disabled", () => {
    render(<Harness disabled />);
    for (const r of screen.getAllByRole("radio")) expect(r).toBeDisabled();
  });
});
