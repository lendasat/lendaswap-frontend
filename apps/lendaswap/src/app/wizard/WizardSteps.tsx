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
  return (
    <div className={cn("w-full py-6", className)}>
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";
          const isUpcoming = step.status === "upcoming";
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex flex-1 items-center">
              {/* Step Button/Pill */}
              <div
                className={cn(
                  "flex-1 rounded-full border-2 px-4 py-2 text-center text-sm font-medium transition-all uppercase tracking-wide",
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
                  className={cn("mx-2 h-0.5 w-8 transition-all", {
                    "bg-primary/30": isCompleted,
                    "bg-muted": !isCompleted,
                  })}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
