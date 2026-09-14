"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { MfaSetupStep } from "@/components/auth/MfaSetupStep";
import { BackupCodesStep } from "@/components/auth/BackupCodesStep";
import { authApi, ApiError } from "@/lib/api-client";
import { cn, focusRing } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{7,}$/;
const MIN_PASSWORD_LENGTH = 8;

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

type Step =
  | { name: "form" }
  | { name: "mfa-setup"; mfaSetupToken: string }
  | { name: "backup-codes"; backupCodes: string[] };

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "form" });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) {
      nextErrors.phone = "Enter a valid phone number.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (!agreedToTerms) {
      nextErrors.terms = "You must accept the Terms of Service to continue.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setSubmitError(null);
    try {
      const res = await authApi.register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone_number: phone.trim() || undefined,
      });
      setStep({ name: "mfa-setup", mfaSetupToken: res.mfa_setup_token });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't create your account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="sm:p-8">
      <div className="relative mx-auto h-16 w-full max-w-[220px]">
        <Logo fill sizes="220px" priority />
      </div>
      <p className="font-accent mt-3 text-center text-sm text-neutral-600">Member loans, simplified</p>

      {step.name === "form" && (
        <>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-neutral-900">Sign up</h1>
          <p className="mt-1 text-sm text-neutral-500">Join Prime&apos;s Vault in a few minutes.</p>

          <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              label="Full name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              placeholder="Sarah Kaupa"
            />

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
            />

            <Input
              label="Phone number (optional)"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
              placeholder="+675 7123 4567"
            />

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              placeholder="At least 8 characters"
            />

            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              placeholder="Re-enter your password"
            />

            <Checkbox
              label="I agree to the Terms of Service and Privacy Policy."
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              error={errors.terms}
            />

            {submitError && <p className="text-sm text-danger">{submitError}</p>}

            <Button type="submit" size="lg" disabled={loading} className="mt-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already have an account?{" "}
            <Link href="/login" className={cn("rounded font-medium text-primary hover:underline", focusRing)}>
              Log in
            </Link>
          </p>
        </>
      )}

      {step.name === "mfa-setup" && (
        <div className="mt-6">
          <MfaSetupStep
            mfaSetupToken={step.mfaSetupToken}
            onVerified={(backupCodes) => setStep({ name: "backup-codes", backupCodes })}
          />
        </div>
      )}

      {step.name === "backup-codes" && (
        <div className="mt-6">
          <BackupCodesStep backupCodes={step.backupCodes} onContinue={() => router.push("/login")} />
        </div>
      )}
    </Card>
  );
}
