import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "fl:flex fl:items-center fl:gap-2 fl:text-sm fl:leading-none fl:font-medium fl:select-none fl:group-data-[disabled=true]:pointer-events-none fl:group-data-[disabled=true]:opacity-50 fl:peer-disabled:cursor-not-allowed fl:peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Label };
