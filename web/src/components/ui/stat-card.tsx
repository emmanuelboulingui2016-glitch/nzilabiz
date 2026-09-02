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
    <Card className={cn("p-5", className)} title={helpText}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </span>
        ) : null}
      </div>
      {/* Le chiffre grossit : c'est la donnée que le commerçant vient chercher en premier sur ce
          tableau de bord, elle doit se lire d'un coup d'œil. */}
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{value}</div>
      {delta ? (
        <div
          className={cn(
            "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
            deltaTone === "positive" && "bg-success/10 text-success",
            deltaTone === "negative" && "bg-danger/10 text-danger",
            deltaTone === "neutral" && "bg-muted text-muted-foreground"
          )}
        >
          {delta}
        </div>
      ) : null}
    </Card>
  );
}
