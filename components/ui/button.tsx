import * as React from "react";
import { Slot as SlotPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
// import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = ({
  className,
  loading = false,
  variant,
  size,
  asChild = false,
  children,
  disabled,
  ...props
}: ButtonProps) => {
  const Comp = asChild ? SlotPrimitive.Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }), "relative")}
      disabled={!!(loading || disabled)}
      {...props}
    >
      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Spinner className={cn("size-6", size === "icon" && "size-5")} />
        </div>
      )}
      <SlotPrimitive.Slottable>
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2",
            loading && "opacity-0",
          )}
        >
          {children}
        </span>
      </SlotPrimitive.Slottable>
    </Comp>
  );
};
Button.displayName = "Button";

export { Button, buttonVariants };
