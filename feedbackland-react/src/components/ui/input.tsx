import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "fl:file:text-foreground fl:placeholder:text-muted-foreground fl:selection:bg-primary fl:selection:text-primary-foreground fl:dark:bg-input/30 fl:border-input fl:h-9 fl:w-full fl:min-w-0 fl:rounded-md fl:border fl:bg-transparent fl:px-3 fl:py-1 fl:text-base fl:shadow-xs fl:transition-[color,box-shadow] fl:outline-none fl:file:inline-flex fl:file:h-7 fl:file:border-0 fl:file:bg-transparent fl:file:text-sm fl:file:font-medium fl:disabled:pointer-events-none fl:disabled:cursor-not-allowed fl:disabled:opacity-50 fl:md:text-sm",
        "fl:focus-visible:border-ring fl:focus-visible:ring-ring/50 fl:focus-visible:ring-[3px]",
        "fl:aria-invalid:ring-destructive/20 fl:dark:aria-invalid:ring-destructive/40 fl:aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
