import * as React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";

const TextareaAutoResize = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <TextareaAutosize
      className={cn(
        "flex min-h-[60px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      minRows={1}
      ref={ref}
      {...(props as any)}
    />
  );
});

TextareaAutoResize.displayName = "TextareaAutoResize";

export { TextareaAutoResize };
