import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Refonte 2026 : la bordure ne fait plus tout le travail de séparation — sur le fond crème, un
// trait franc marquait plus qu'il n'aidait. On la garde très légère (border/60) et on laisse
// l'ombre teintée (shadow-carte, verte et non grise) porter le relief de la carte.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border/60 bg-card text-card-foreground shadow-carte", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-5 pb-2.5", className)} {...props} />;
}

// Le gris discret par défaut était systématiquement réécrit à la main (text-foreground, font-bold)
// dans la moitié des écrans qui l'utilisent : c'est le signe que ce n'était pas la bonne valeur de
// départ. Le titre de carte doit se voir — c'est lui qui fait la hiérarchie de la page.
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-bold tracking-tight text-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2.5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}
