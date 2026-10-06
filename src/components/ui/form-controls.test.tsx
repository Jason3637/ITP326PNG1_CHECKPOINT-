import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";
import { Textarea } from "./Textarea";
import { Checkbox } from "./Checkbox";
import { RadioCardGroup } from "./RadioCardGroup";

describe("Button", () => {
  it("disables itself and reports busy while loading, keeping its label", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is 40px by default and 44px inside a comfortable-density area", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("h-10", "comfortable:h-11");
  });
});

describe("Input / Select / Textarea", () => {
  it("labels the control and announces the hint and the error with it", () => {
    render(<Input label="Reference" hint="From the bank's confirmation." error="Enter the reference." requirement="required" />);
    const input = screen.getByLabelText(/Reference/);
    expect(screen.getByText("(required)")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("From the bank's confirmation. Enter the reference.");
  });

  it("has no description when there's no hint or error", () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
  });

  it("renders a labelled native select", async () => {
    const onChange = vi.fn();
    render(
      <Select label="Actor role" defaultValue="" onChange={onChange}>
        <option value="">Anyone</option>
        <option value="admin">Administrator</option>
      </Select>,
    );
    await userEvent.selectOptions(screen.getByLabelText("Actor role"), "admin");
    expect(onChange).toHaveBeenCalled();
  });

  it("counts characters against maxLength when asked", async () => {
    function Controlled() {
      const [v, setV] = useState("");
      return <Textarea label="Note" maxLength={20} showCount value={v} onChange={(e) => setV(e.target.value)} />;
    }
    render(<Controlled />);
    expect(screen.getByText("0 / 20")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Note"), "Paid");
    expect(screen.getByText("4 / 20")).toBeInTheDocument();
  });

  it("checkbox announces its hint", () => {
    render(<Checkbox label="Notify the customer" hint="By SMS." />);
    expect(screen.getByRole("checkbox", { name: "Notify the customer" })).toHaveAccessibleDescription("By SMS.");
  });
});

describe("RadioCardGroup", () => {
  function Group({ onChange = () => {} }: { onChange?: (v: string) => void }) {
    const [value, setValue] = useState<"approve" | "reject" | "">("");
    return (
      <RadioCardGroup
        legend="Decision"
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
        options={[
          { value: "approve", label: "Approve", description: "Moves it to disbursement." },
          { value: "reject", label: "Reject" },
        ]}
      />
    );
  }

  it("is a named radio group of native radios", () => {
    render(<Group />);
    expect(screen.getByRole("group", { name: "Decision" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /Approve/ })).not.toBeChecked();
  });

  it("selects by click and by arrow key", async () => {
    const onChange = vi.fn();
    render(<Group onChange={onChange} />);
    await userEvent.click(screen.getByText("Approve"));
    expect(screen.getByRole("radio", { name: /Approve/ })).toBeChecked();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Reject" })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith("reject");
  });
});
