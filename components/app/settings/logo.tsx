"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileWithPath, useDropzone } from "react-dropzone";
import { ImageCropper } from "@/components/ui/image-cropper";
import { cn } from "@/lib/utils";

export type FileWithPreview = FileWithPath & {
  preview: string;
};

const accept = {
  "image/*": [],
};

export function Logo({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const [selectedFile, setSelectedFile] =
    React.useState<FileWithPreview | null>(null);
  const [isDialogOpen, setDialogOpen] = React.useState(false);

  const onDrop = React.useCallback((acceptedFiles: FileWithPath[]) => {
    const file = acceptedFiles[0];
    if (!file) {
      alert("Selected image is too large!");
      return;
    }

    const fileWithPreview = Object.assign(file, {
      preview: URL.createObjectURL(file),
    });

    setSelectedFile(fileWithPreview);
    setDialogOpen(true);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept,
  });

  return (
    <div className={cn("", className)}>
      {selectedFile ? (
        <ImageCropper
          dialogOpen={isDialogOpen}
          setDialogOpen={setDialogOpen}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
        />
      ) : (
        <Avatar
          {...getRootProps()}
          className="size-36 cursor-pointer ring-2 ring-slate-200 ring-offset-2"
        >
          <input {...getInputProps()} />
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
