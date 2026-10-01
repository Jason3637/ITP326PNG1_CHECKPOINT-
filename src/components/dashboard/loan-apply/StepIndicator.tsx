import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const WIZARD_STEPS = ["Basic Details", "Loan Details", "Document Upload", "Review & Submit"] as const;

interface StepIndicatorProps {
  currentStep: number; // 0-indexed
}

// Mobile-first: circles + connecting lines are always visible and compact
// enough for a 375px screen; full step labels only appear at sm: and above
// (same breakpoint QuickActions already uses to go from a 2-col to 4-col
// grid). Below sm, only the current step's label is shown as a caption so
// the customer still always knows where they are.
export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div>
      <ol className="flex items-center">
        {WIZARD_STEPS.map((label, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === WIZARD_STEPS.length - 1;

          return (
            <li key={label} className={cn("flex items-center", !isLast && "flex-1")}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isComplete && "bg-primary text-white",
                    isCurrent && "border-2 border-primary bg-primary-light text-primary-dark",
                    !isComplete && !isCurrent && "border border-neutral-300 bg-white text-neutral-400",
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-center text-xs font-medium sm:block",
                    isCurrent ? "text-primary-dark" : "text-neutral-500",
                  )}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={cn("mx-1.5 h-0.5 flex-1 rounded-full sm:mx-2", isComplete ? "bg-primary" : "bg-neutral-200")}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs font-medium text-neutral-500 sm:hidden">
        Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep]}
      </p>
    </div>
  );
}
