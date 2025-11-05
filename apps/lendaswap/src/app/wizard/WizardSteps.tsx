import { cn } from "#/lib/utils";

interface Step {
  id: string;
  label: string;
  labelCompleted?: string;
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
    <div className={cn("w-full", className)}>
      <div
        className="grid items-center gap-3"
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
                  "relative rounded-xl border px-4 py-3 text-center text-xs font-semibold transition-all uppercase tracking-wider whitespace-nowrap overflow-hidden",
                  {
                    "border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-lg shadow-primary/20":
                      isCompleted,
                    "border-primary bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/30 scale-105":
                      isCurrent,
                    "border-border/50 bg-gradient-to-br from-muted/30 to-muted/20 text-muted-foreground":
                      isUpcoming,
                  },
                )}
              >
                {isCurrent && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                )}
                <div className="relative">
                  {isCompleted && step.labelCompleted
                    ? step.labelCompleted
                    : step.label}
                </div>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  key={`connector-${step.id}`}
                  className={cn("h-[2px] w-12 transition-all rounded-full", {
                    "bg-gradient-to-r from-primary/50 to-primary/30":
                      isCompleted,
                    "bg-border/30": !isCompleted,
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
