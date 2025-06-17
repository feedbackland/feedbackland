import * as React from "react";
import type { Editor } from "@tiptap/react";
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
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      const insertImages = async () => {
        const contentBucket = [];
        const filesArray = Array.from(files);

        for (const file of filesArray) {
          contentBucket.push({ src: file });
        }

        editor.commands.setImages(contentBucket);
      };

      await insertImages();

      editor
        .chain()
        .focus()
        .enter() // Add the new paragraph
        .focus() // Re-focus might be needed
        .setTextSelection(editor.state.doc.content.size) // Move cursor to the end
        .run();
    },
    [editor],
  );

  return (
    <div className="">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
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
        <TooltipContent>Upload images</TooltipContent>
      </Tooltip>

      {/* <ToolbarButton
        isActive={editor.isActive("image")}
        tooltip="Upload images"
        aria-label="Upload images"
        onClick={handleClick}
      >
        <ImageIcon className="size-3.5!" />
      </ToolbarButton> */}

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
