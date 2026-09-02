import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

// Le rayon vit désormais dans chaque variante plutôt que dans le tronc commun : la charte réserve
// la forme pilule (rounded-full) au bouton "principal" d'un écran, pour qu'il reste le seul repère
// visuel évident. Les autres gardent un rectangle arrondi, plus discret.
const variantClasses: Record<Variant, string> = {
  primary: "rounded-full bg-primary text-primary-foreground shadow-carte hover:opacity-90 hover:shadow-relief",
  secondary: "rounded-lg bg-muted text-foreground hover:bg-border/70",
  outline: "rounded-lg border border-border bg-transparent hover:bg-muted",
  ghost: "rounded-lg bg-transparent hover:bg-muted",
  danger: "rounded-lg bg-danger text-white hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none",
          // Anneau de focus visible : le tronc commun n'en avait aucun, ce qui rendait la
          // navigation au clavier invisible sur la plupart des écrans.
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.98]",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
