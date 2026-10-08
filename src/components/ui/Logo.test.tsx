import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("renders the brand name and tagline as real text next to the logo image", () => {
    const { container } = render(<Logo size="lg" tagline="Your Financial Assistant" />);
    expect(screen.getByText("PRIMESTONE")).toBeInTheDocument();
    expect(screen.getByText("Your Financial Assistant")).toBeInTheDocument();
    // The image is decorative here - the name is already in the text.
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("hides the mark from screen readers next to the wordmark, so the name is read once", () => {
    render(<Logo size="sm" />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("labels the mark when it stands alone", () => {
    render(<Logo variant="mark" />);
    expect(screen.getByRole("img", { name: "PRIMESTONE" })).toBeInTheDocument();
    expect(screen.queryByText("PRIMESTONE")).toBeNull();
  });

  it("falls back to the monogram if the logo image fails to load", () => {
    render(<Logo variant="mark" />);
    fireEvent.error(screen.getByRole("img", { name: "PRIMESTONE" }));
    const mark = screen.getByRole("img", { name: "PRIMESTONE" });
    expect(mark.tagName).toBe("SPAN");
    expect(mark).toHaveTextContent("P");
  });
});
