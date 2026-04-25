import * as React from "react";
import { Slot as SlotPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "fl:inline-flex fl:items-center fl:justify-center fl:gap-2 fl:whitespace-nowrap fl:rounded-md fl:text-sm fl:font-medium fl:transition-all fl:disabled:pointer-events-none fl:disabled:opacity-50 fl:[&_svg]:pointer-events-none fl:[&_svg:not([class*='size-'])]:size-4 fl:shrink-0 fl:[&_svg]:shrink-0 fl:outline-none fl:focus-visible:border-ring fl:focus-visible:ring-ring/50 fl:focus-visible:ring-[3px] fl:aria-invalid:ring-destructive/20 fl:dark:aria-invalid:ring-destructive/40 fl:aria-invalid:border-destructive fl:cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "fl:bg-primary fl:text-primary-foreground fl:hover:bg-primary/90",
        destructive:
          "fl:bg-destructive fl:text-white fl:hover:bg-destructive/90 fl:focus-visible:ring-destructive/20 fl:dark:focus-visible:ring-destructive/40 fl:dark:bg-destructive/60",
        outline:
          "fl:border fl:bg-background fl:shadow-xs fl:hover:bg-accent fl:text-primary fl:hover:text-accent-foreground fl:dark:bg-input/30 fl:dark:border-input fl:dark:hover:bg-input/50",
        secondary:
          "fl:bg-secondary fl:text-secondary-foreground fl:hover:bg-secondary/80",
        ghost:
          "fl:hover:bg-accent fl:hover:text-accent-foreground fl:dark:hover:bg-accent/50",
        link: "fl:text-primary fl:underline-offset-4 fl:hover:underline",
      },
      size: {
        default: "fl:h-9 fl:px-4 fl:py-2 fl:has-[>svg]:px-3",
        sm: "fl:h-8 fl:rounded-md fl:gap-1.5 fl:px-3 fl:has-[>svg]:px-2.5",
        lg: "fl:h-10 fl:rounded-md fl:px-6 fl:has-[>svg]:px-4",
        icon: "fl:size-9",
        "icon-sm": "fl:size-8",
        "icon-lg": "fl:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
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
      className={cn(
        buttonVariants({ variant, size, className }),
        "fl:relative"
      )}
      disabled={!!(loading || disabled)}
      {...props}
    >
      {loading && (
        <div className="fl:absolute fl:top-1/2 fl:left-1/2 fl:-translate-x-1/2 fl:-translate-y-1/2">
          <Spinner
            className={cn("fl:size-6!", size === "icon" && "fl:size-5!")}
          />
        </div>
      )}
      <SlotPrimitive.Slottable>
        <span
          className={cn(
            "fl:inline-flex fl:items-center fl:justify-center fl:gap-2",
            loading && "fl:opacity-0"
          )}
        >
          {children}
        </span>
      </SlotPrimitive.Slottable>
    </Comp>
  );
};

export { Button, buttonVariants };
