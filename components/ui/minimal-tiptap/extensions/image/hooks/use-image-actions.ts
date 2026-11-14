import * as React from "react";
import type { Editor } from "@tiptap/react";
import type { Node } from "@tiptap/pm/model";

interface UseImageActionsProps {
  editor: Editor;
  node: Node;
  onViewClick: (value: boolean) => void;
}

export type ImageActionHandlers = {
  onView?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  onCopyLink?: () => void;
};

export const useImageActions = ({
  editor,
  node,
  onViewClick,
}: UseImageActionsProps) => {
  const onView = React.useCallback(() => {
    onViewClick(true);
  }, [onViewClick]);

  const onDownload = React.useCallback(() => {
    editor.commands.downloadImage({ src: node.attrs.src, alt: node.attrs.alt });
  }, [editor.commands, node.attrs.alt, node.attrs.src]);

  const onCopy = React.useCallback(() => {
    editor.commands.copyImage({ src: node.attrs.src });
  }, [editor.commands, node.attrs.src]);

  const onCopyLink = React.useCallback(() => {
    editor.commands.copyLink({ src: node.attrs.src });
  }, [editor.commands, node.attrs.src]);

  return { onView, onDownload, onCopy, onCopyLink };
};
