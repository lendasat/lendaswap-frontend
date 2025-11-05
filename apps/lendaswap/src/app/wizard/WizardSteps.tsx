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
      {/* Mobile: Vertical Layout */}
      <div className="flex md:hidden flex-col">
        {steps.map((step, index) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";
          const isUpcoming = step.status === "upcoming";
          const isLast = index === steps.length - 1;

          return (
            <div key={index} className="flex gap-3">
              {/* Circle Indicator with Connector Line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    {
                      "border-primary bg-primary/20": isCompleted,
                      "border-primary bg-primary scale-110": isCurrent,
                      "border-border/50 bg-muted/20": isUpcoming,
                    },
                  )}
                >
                  {isCompleted && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                  {isCurrent && (
                    <div className="h-2 w-2 rounded-full bg-primary-foreground animate-pulse" />
                  )}
                </div>
                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-[2px] flex-1 my-1 transition-all rounded-full",
                      {
                        "bg-gradient-to-b from-primary/50 to-primary/30":
                          isCompleted,
                        "bg-border/30": !isCompleted,
                      },
                    )}
                    style={{ minHeight: "24px" }}
                  />
                )}
              </div>

              {/* Step Label */}
              <div
                className={cn(
                  "flex-1 text-sm font-semibold uppercase tracking-wider transition-all pb-6",
                  {
                    "text-secondary": isCompleted,
                    "text-primary": isCurrent,
                    "text-muted-foreground": isUpcoming,
                  },
                )}
              >
                {isCompleted && step.labelCompleted
                  ? step.labelCompleted
                  : step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Horizontal Layout */}
      <div
        className="hidden md:grid items-center gap-3"
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
                  "relative rounded-xl border px-3 py-2 text-center text-[8px] font-semibold transition-all uppercase tracking-wider whitespace-nowrap overflow-hidden",
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
