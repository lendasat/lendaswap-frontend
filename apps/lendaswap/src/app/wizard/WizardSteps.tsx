import { cn } from "#/lib/utils";

interface Step {
  id: string;
  label: string;
  status: "completed" | "current" | "upcoming";
}

interface WizardStepsProps {
  steps: Step[];
  className?: string;
}

export function WizardSteps({ steps, className }: WizardStepsProps) {
  // Build grid template: step (1fr), connector (auto), step (1fr), connector (auto), etc.
  const gridTemplate = steps
    .map((_, index) => (index === steps.length - 1 ? "1fr" : "1fr auto"))
    .join(" ");

  return (
    <div className={cn("w-full py-6", className)}>
      <div
        className="grid items-center gap-2"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {steps.map((step, index) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";
          const isUpcoming = step.status === "upcoming";
          const isLast = index === steps.length - 1;

          return (
            <>
              {/* Step Button/Pill */}
              <div
                key={index}
                className={cn(
                  "rounded-full border-2 px-3 py-2 text-center text-xs font-medium transition-all uppercase tracking-wide whitespace-nowrap",
                  {
                    "border-primary/20 bg-primary/10 text-primary": isCompleted,
                    "border-primary bg-primary text-primary-foreground":
                      isCurrent,
                    "border-muted bg-muted/50 text-muted-foreground":
                      isUpcoming,
                  },
                )}
              >
                {step.label}
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  key={`connector-${step.id}`}
                  className={cn("h-0.5 w-8 transition-all", {
                    "bg-primary/30": isCompleted,
                    "bg-muted": !isCompleted,
                  })}
                />
              )}
            </>
          );
        })}
      </div>
    </div>
  );
}
