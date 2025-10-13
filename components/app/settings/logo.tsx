"use client";

import React, { useEffect, useState } from "react";
import { FileWithPath, useDropzone } from "react-dropzone";
import { cn, uploadImage } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { PenIcon, TrashIcon, UploadIcon } from "lucide-react";
import { ImageCropper } from "@/components/ui/image-cropper";
import Image from "next/image";
import { useUpdateOrg } from "@/hooks/use-update-org";
import { useOrg } from "@/hooks/use-org";
import { Button } from "@/components/ui/button";

export type FileWithPreview = FileWithPath & {
  preview: string;
};

export function Logo({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [remoteImageUrl, setRemoteImageUrl] = useState<string | null>(null);
  const [localImage, setLocalImage] = useState<string | null>(null);

  const {
    query: { data },
  } = useOrg();

  useEffect(() => {
    if (data?.logo) {
      setRemoteImageUrl(data?.logo);
    }
  }, [data]);

  const updateOrg = useUpdateOrg();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onDrop = async (acceptedFiles: FileWithPath[]) => {
    const file = acceptedFiles[0];
    const base64Image = await fileToBase64(file);
    setLocalImage(base64Image);
    setDialogOpen(true);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [],
      "image/png": [],
    },
    multiple: false,
    maxFiles: 1,
  });

  const onSave = async (image: string) => {
    const { publicUrl } = await uploadImage(image);

    setRemoteImageUrl(publicUrl);

    await updateOrg.mutateAsync({
      logo: publicUrl,
    });

    setLocalImage(null);

    return true;
  };

  const onRemove = async () => {
    await updateOrg.mutateAsync({
      logo: null,
    });

    setRemoteImageUrl(null);
  };

  return (
    <>
      <ImageCropper
        open={isDialogOpen}
        imageSrc={localImage}
        onClose={() => setDialogOpen(false)}
        onCrop={async (image) => {
          await onSave(image);
          setDialogOpen(false);
        }}
      />
      <div className={cn("", className)}>
        <div className="flex items-start gap-6">
          <div className="flex flex-1 flex-col items-stretch gap-2">
            <Label>Logo</Label>
            <div
              {...getRootProps()}
              className="hover:border-primary flex size-[100px] cursor-pointer items-center justify-center border-2 border-dashed"
            >
              {remoteImageUrl ? (
                <Image
                  src={remoteImageUrl}
                  alt="logo"
                  width={96}
                  height={96}
                  className="size-[96px] object-contain"
                />
              ) : (
                <UploadIcon className="text-muted-foreground" />
              )}

              <input {...getInputProps()} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {remoteImageUrl && (
              <Button
                className=""
                size="sm"
                variant="outline"
                onClick={onRemove}
              >
                <TrashIcon className="size-3" />
                Remove
              </Button>
            )}
            <Button
              className=""
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              {...getRootProps()}
            >
              <PenIcon className="size-3" />
              Edit
              <input {...getInputProps()} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
