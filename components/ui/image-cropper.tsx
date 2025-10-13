"use client";

import React, { useEffect, useRef, useState, type SyntheticEvent } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import "react-image-crop/dist/ReactCrop.css";
import { CropIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { FileWithPath } from "react-dropzone";
import { set } from "date-fns";

export type FileWithPreview = FileWithPath & {
  preview: string;
};

export function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 50,
        height: 50,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return "";
  }

  const { naturalWidth, naturalHeight, width, height } = image;

  const imageAspectRatio = naturalWidth / naturalHeight;
  const containerAspectRatio = width / height;

  let renderWidth,
    renderHeight,
    xOffset = 0,
    yOffset = 0;

  if (imageAspectRatio > containerAspectRatio) {
    renderWidth = width;
    renderHeight = width / imageAspectRatio;
    yOffset = (height - renderHeight) / 2;
  } else {
    renderHeight = height;
    renderWidth = height * imageAspectRatio;
    xOffset = (width - renderWidth) / 2;
  }

  const scaleX = naturalWidth / renderWidth;
  const scaleY = naturalHeight / renderHeight;

  const sourceX = (crop.x - xOffset) * scaleX;
  const sourceY = (crop.y - yOffset) * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  return canvas.toDataURL("image/png", 1.0);
}

export function ImageCropper({
  open,
  imageSrc,
  onClose,
  onCrop,
}: {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCrop: (croppedImage: string) => void;
}) {
  const aspect = 1;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setProcessing(false);
  }, [open]);

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }

  function onCropComplete(crop: PixelCrop) {
    if (imgRef.current && crop.width && crop.height) {
      const croppedImageUrl = getCroppedImg(imgRef.current, crop);
      setCroppedImage(croppedImageUrl);
    }
  }

  async function handleOnCrop() {
    if (croppedImage) {
      onCrop(croppedImage);
      setProcessing(true);
    } else {
      handleOnClose();
    }
  }

  const handleOnClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleOnClose();
      }}
    >
      <DialogContent className="">
        <DialogTitle className="sr-only">Upload logo</DialogTitle>
        <div className="mx-auto size-96!">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => onCropComplete(c)}
            aspect={aspect}
            className="w-full"
          >
            <img
              ref={imgRef}
              className="size-96! rounded-none object-contain"
              alt="Image Cropper"
              src={imageSrc || undefined}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>
        <DialogFooter className="">
          <DialogClose asChild>
            <Button
              size={"sm"}
              type="reset"
              className="w-fit"
              variant={"outline"}
              onClick={handleOnClose}
            >
              <Trash2Icon className="mr-1.5 size-4" />
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            size={"sm"}
            className="w-fit"
            onClick={handleOnCrop}
            loading={processing}
          >
            <UploadIcon className="mr-1.5 size-4" />
            Crop and upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
