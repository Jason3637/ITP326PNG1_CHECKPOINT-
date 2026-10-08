import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const login = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {}
  return { ApiError, authApi: { login: (...a: unknown[]) => login(...a) } };
});
vi.mock("@/components/auth/MfaVerifyLoginStep", () => ({
  MfaVerifyLoginStep: () => <p>MFA challenge step</p>,
}));

import LoginPage from "./page";

describe("Login page", () => {
  beforeEach(() => {
    login.mockReset();
  });

  it("has the PRIMESTONE layout and copy", () => {
    render(<LoginPage />);
    expect(screen.getByText("PRIMESTONE")).toBeInTheDocument();
    expect(screen.getByText("Your Financial Assistant")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Welcome to PRIMESTONE. Sign in to manage your loan account.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "you@example.com");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("button", { name: "Log in" })).toHaveAttribute("type", "submit");

    const signup = screen.getByRole("link", { name: "Create an account" });
    expect(signup).toHaveAttribute("href", "/signup");
    expect(signup.parentElement).toHaveTextContent("New to PRIMESTONE? Create an account");
  });

  it("puts the Forgot password link on the label's row, not under the field", () => {
    render(<LoginPage />);
    const labelRow = screen.getByText("Password", { selector: "label" }).parentElement!;
    expect(within(labelRow).getByRole("link", { name: "Forgot password?" })).toBeInTheDocument();
  });

  it("toggles the password between masked and plain text", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(password).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(password).toHaveAttribute("type", "password");
  });

  it("still validates before submitting", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("still submits, shows the loading state, and moves to the MFA challenge", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    login.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), " jane@example.com ");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(login).toHaveBeenCalledWith({ email: "jane@example.com", password: "secret" });
    expect(screen.getByRole("button", { name: /Logging in/ })).toBeDisabled();

    resolve({ mfa_required: "challenge", mfa_challenge_token: "tok" });
    expect(await screen.findByText("MFA challenge step")).toBeInTheDocument();
  });

  it("still shows the backend's message when login is refused", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({ message: "Account disabled." });
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Account disabled.")).toBeInTheDocument();
  });
});
