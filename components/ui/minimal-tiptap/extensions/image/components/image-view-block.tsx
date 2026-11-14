/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Controlled as Zoom } from "react-medium-image-zoom";
import { ImageActions } from "./image-actions";
import { useImageActions } from "../hooks/use-image-actions";
import { retryUpload } from "../../../upload";
import { imageId } from "@/lib/images/path";
export function ImageViewBlock({ editor, node, deleteNode }: NodeViewProps) {
  const { src, width, height, alt } = node.attrs;
  const pending = typeof src === "string" && src.startsWith("blob:");
  const [zoomed, setZoomed] = useState(false);
  const actions = useImageActions({ editor, node, onViewClick: setZoomed });
  return (
    <NodeViewWrapper className="group/node-image relative">
      {pending ? (
        node.attrs.uploadError ? (
          <span contentEditable={false}>
            <span role="alert">{node.attrs.uploadError}</span>{" "}
            <button
              type="button"
              className="underline"
              onClick={() => retryUpload(src)}
            >
              Retry upload
            </button>
          </span>
        ) : (
          <span role="status">Uploading image…</span>
        )
      ) : imageId(src) ? (
        <>
          <Zoom isZoomed={zoomed} onZoomChange={setZoomed}>
            <img
              src={src}
              alt={alt ?? "Attached image"}
              width={width ?? undefined}
              height={height ?? undefined}
              className="h-auto max-h-[600px] max-w-full object-contain"
            />
          </Zoom>
          <ImageActions {...actions} isLink />
        </>
      ) : null}
      <button type="button" className="text-xs underline" onClick={deleteNode}>
        Remove image
      </button>
    </NodeViewWrapper>
  );
}
