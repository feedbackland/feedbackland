import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "fl:border-input fl:placeholder:text-muted-foreground fl:focus-visible:border-ring fl:focus-visible:ring-ring/50 fl:aria-invalid:ring-destructive/20 fl:dark:aria-invalid:ring-destructive/40 fl:aria-invalid:border-destructive fl:dark:bg-input/30 fl:flex fl:field-sizing-content fl:min-h-16 fl:w-full fl:rounded-md fl:border fl:bg-transparent fl:px-3 fl:py-2 fl:text-base fl:shadow-xs fl:transition-[color,box-shadow] fl:outline-none fl:focus-visible:ring fl:disabled:cursor-not-allowed fl:disabled:opacity-50 fl:md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
