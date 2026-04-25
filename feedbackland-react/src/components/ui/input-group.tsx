import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "fl:group/input-group fl:border-input fl:dark:bg-input/30 fl:relative fl:flex fl:w-full fl:items-center fl:rounded-md fl:border fl:shadow-xs fl:transition-[color,box-shadow] fl:outline-none",
        "fl:h-9 fl:min-w-0 fl:has-[>textarea]:h-auto",

        // Variants based on alignment.
        "fl:has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "fl:has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "fl:has-[>[data-align=block-start]]:h-auto fl:has-[>[data-align=block-start]]:flex-col fl:has-[>[data-align=block-start]]:[&>input]:pb-3",
        "fl:has-[>[data-align=block-end]]:h-auto fl:has-[>[data-align=block-end]]:flex-col fl:has-[>[data-align=block-end]]:[&>input]:pt-3",

        // Focus state.
        "fl:has-[[data-slot=input-group-control]:focus-visible]:border-ring fl:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 fl:has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",

        // Error state.
        "fl:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 fl:has-[[data-slot][aria-invalid=true]]:border-destructive fl:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",

        className
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "fl:text-muted-foreground fl:flex fl:h-auto fl:cursor-text fl:items-center fl:justify-center fl:gap-2 fl:py-1.5 fl:text-sm fl:font-medium fl:select-none fl:[&>svg:not([class*='size-'])]:size-4 fl:[&>kbd]:rounded-[calc(var(--radius)-5px)] fl:group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        "inline-start":
          "fl:order-first fl:pl-3 fl:has-[>button]:ml-[-0.45rem] fl:has-[>kbd]:ml-[-0.35rem]",
        "inline-end":
          "fl:order-last fl:pr-3 fl:has-[>button]:mr-[-0.45rem] fl:has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "fl:order-first fl:w-full fl:justify-start fl:px-3 fl:pt-3 fl:[.border-b]:pb-3 fl:group-has-[>input]/input-group:pt-2.5",
        "block-end":
          "fl:order-last fl:w-full fl:justify-start fl:px-3 fl:pb-3 fl:[.border-t]:pt-3 fl:group-has-[>input]/input-group:pb-2.5",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
);

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "fl:text-sm fl:shadow-none fl:flex fl:gap-2 fl:items-center",
  {
    variants: {
      size: {
        xs: "fl:h-6 fl:gap-1 fl:px-2 fl:rounded-[calc(var(--radius)-5px)] fl:[&>svg:not([class*='size-'])]:size-3.5 fl:has-[>svg]:px-2",
        sm: "fl:h-8 fl:px-2.5 fl:gap-1.5 fl:rounded-md fl:has-[>svg]:px-2.5",
        "icon-xs":
          "fl:size-6 fl:rounded-[calc(var(--radius)-5px)] fl:p-0 fl:has-[>svg]:p-0",
        "icon-sm": "fl:size-8 fl:p-0 fl:has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
);

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "fl:text-muted-foreground fl:flex fl:items-center fl:gap-2 fl:text-sm fl:[&_svg]:pointer-events-none fl:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "fl:flex-1 fl:rounded-none fl:border-0 fl:bg-transparent fl:shadow-none fl:focus-visible:ring-0 fl:dark:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "fl:flex-1 fl:resize-none fl:rounded-none fl:border-0 fl:bg-transparent fl:py-3 fl:shadow-none fl:focus-visible:ring-0 fl:dark:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
