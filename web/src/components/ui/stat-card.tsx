import { type ReactNode } from "react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  icon,
  className,
  helpText,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
  className?: string;
  helpText?: string;
}) {
  return (
    <Card className={cn("p-4", className)} title={helpText}>
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon ? <span className="text-primary">{icon}</span> : null}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {delta ? (
        <div
          className={cn(
            "mt-1 text-xs font-medium",
            deltaTone === "positive" && "text-success",
            deltaTone === "negative" && "text-danger",
            deltaTone === "neutral" && "text-muted-foreground"
          )}
        >
          {delta}
        </div>
      ) : null}
    </Card>
  );
}
