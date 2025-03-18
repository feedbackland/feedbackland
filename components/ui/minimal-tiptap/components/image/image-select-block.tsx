import * as React from "react";
import type { Editor } from "@tiptap/react";
import { ImageIcon } from "@radix-ui/react-icons";
import { ToolbarButton } from "../toolbar-button";

export const ImageSelectBlock = ({ editor }: { editor: Editor }) => {
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
    },
    [editor],
  );

  return (
    <div className="">
      <ToolbarButton
        isActive={editor.isActive("image")}
        tooltip="Upload images"
        aria-label="Image"
        onClick={handleClick}
      >
        <ImageIcon className="size-3.5!" />
      </ToolbarButton>
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
