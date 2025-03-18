import * as React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";

const TextareaAutoResize = ({
  className,
  ...props
}: React.ComponentProps<"textarea">) => {
  return (
    <TextareaAutosize
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      minRows={1}
      {...(props as any)}
    />
  );
};

TextareaAutoResize.displayName = "TextareaAutoResize";

export { TextareaAutoResize };
