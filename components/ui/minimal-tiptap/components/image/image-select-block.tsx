import * as React from "react";
import type { Editor } from "@tiptap/react";
import { uploadHelp } from "../../upload";
import { ImageIcon } from "@radix-ui/react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export const ImageSelectBlock = ({
  editor,
  disabled = false,
}: {
  editor: Editor;
  disabled?: boolean;
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFile = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      editor.commands.setImages(Array.from(files, (file) => ({ src: file })));
      e.target.value = "";

      editor.commands.focus();
    },
    [editor],
  );

  return (
    <div className="">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            aria-label="Attach images"
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className="size-7!"
            disabled={disabled}
          >
            <ImageIcon className="size-3.5!" />
            <span className="sr-only">Upload images</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{uploadHelp}</TooltipContent>
      </Tooltip>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};
