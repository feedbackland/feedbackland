import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "fl:bg-popover fl:text-popover-foreground fl:data-[state=open]:animate-in fl:data-[state=closed]:animate-out fl:data-[state=closed]:fade-out-0 fl:data-[state=open]:fade-in-0 fl:data-[state=closed]:zoom-out-95 fl:data-[state=open]:zoom-in-95 fl:data-[side=bottom]:slide-in-from-top-2 fl:data-[side=left]:slide-in-from-right-2 fl:data-[side=right]:slide-in-from-left-2 fl:data-[side=top]:slide-in-from-bottom-2 fl:z-50 fl:w-72 fl:origin-(--radix-popover-content-transform-origin) fl:rounded-md fl:border fl:border-border fl:p-4 fl:shadow-md fl:outline-hidden",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
