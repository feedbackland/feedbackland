"use client";

import React, { useRef, useState, type SyntheticEvent } from "react";
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
import { Trash2Icon, UploadIcon } from "lucide-react";
function centerAspectCrop(
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

function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Image cropping is unavailable.");
  }

  const { naturalWidth, naturalHeight, width, height } = image;

  const scaleX = naturalWidth / width,
    scaleY = naturalHeight / height;
  const sourceX = crop.x * scaleX,
    sourceY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX,
    sourceHeight = crop.height * scaleY;
  const scale = Math.min(1, 2000 / Math.max(sourceWidth, sourceHeight));
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image cropping failed.")),
      "image/png",
    ),
  );
}

export function ImageCropper({
  open,
  imageSrc,
  onClose,
  onCrop,
  committing,
}: {
  committing: boolean;
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCrop: (croppedImage: Blob) => Promise<void>;
}) {
  const aspect = 1;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }

  function onCropComplete(crop: PixelCrop) {
    if (imgRef.current && crop.width && crop.height) {
      setCompletedCrop(crop);
    }
  }

  async function handleOnCrop() {
    if (!completedCrop || !imgRef.current || processing) return;
    setProcessing(true);
    setError("");
    try {
      await onCrop(await getCroppedImg(imgRef.current, completedCrop));
    } catch {
      setError(
        "The logo could not be cropped. Choose another image and try again.",
      );
    } finally {
      setProcessing(false);
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
      <DialogContent closeDisabled={committing}>
        <DialogTitle className="sr-only">Upload logo</DialogTitle>
        <div className="mx-auto flex max-w-full items-center justify-center">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => onCropComplete(c)}
            aspect={aspect}
            className="max-w-full"
          >
            <img
              ref={imgRef}
              className="block h-auto max-h-96 max-w-full rounded-none"
              alt="Image Cropper"
              src={imageSrc || undefined}
              onLoad={onImageLoad}
              onError={() => {
                setCompletedCrop(undefined);
                setError(
                  "This browser could not decode the logo. Cancel and choose another image.",
                );
              }}
            />
          </ReactCrop>
        </div>
        {error && <p role="alert">{error}</p>}
        <DialogFooter className="">
          <DialogClose asChild>
            <Button
              size={"sm"}
              type="button"
              disabled={committing}
              className="w-fit"
              variant={"outline"}
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
            disabled={!completedCrop || processing}
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
