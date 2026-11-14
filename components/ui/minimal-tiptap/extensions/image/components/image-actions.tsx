import * as React from "react";
import { canCopyImage } from "@/lib/copy-text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ClipboardCopyIcon,
  DownloadIcon,
  Link2Icon,
  SizeIcon,
} from "@radix-ui/react-icons";

interface ImageActionsProps {
  isLink?: boolean;
  onView?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  onCopyLink?: () => void;
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  tooltip: string;
}

export const ActionWrapper = React.memo(
  ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
      className={cn(
        "absolute top-1 right-1 flex max-w-full flex-wrap rounded-md px-0.5 opacity-0 group-hover/node-image:opacity-100 focus-within:opacity-100",
        "border-[0.5px] bg-[var(--mt-bg-secondary)] [backdrop-filter:saturate(1.8)_blur(20px)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);

ActionWrapper.displayName = "ActionWrapper";

export const ActionButton = React.memo(
  ({ icon, tooltip, className, ...props }: ActionButtonProps) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          aria-label={tooltip}
          variant="ghost"
          className={cn(
            "text-muted-foreground hover:text-foreground relative flex h-7 w-7 flex-row rounded-none p-0",
            "bg-transparent hover:bg-transparent",
            className,
          )}
          {...props}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  ),
);

ActionButton.displayName = "ActionButton";

type ActionKey = "onView" | "onDownload" | "onCopy" | "onCopyLink";

const ActionItems: Array<{
  key: ActionKey;
  icon: React.ReactNode;
  tooltip: string;
  isLink?: boolean;
}> = [
  {
    key: "onView",
    icon: <SizeIcon className="size-4" />,
    tooltip: "View image",
  },
  {
    key: "onDownload",
    icon: <DownloadIcon className="size-4" />,
    tooltip: "Download image",
  },
  {
    key: "onCopy",
    icon: <ClipboardCopyIcon className="size-4" />,
    tooltip: "Copy image to clipboard",
  },
  {
    key: "onCopyLink",
    icon: <Link2Icon className="size-4" />,
    tooltip: "Copy image link",
    isLink: true,
  },
];

export const ImageActions: React.FC<ImageActionsProps> = React.memo(
  ({ isLink = false, ...actions }) => {
    const copyingAvailable = React.useSyncExternalStore(
      () => () => {},
      canCopyImage,
      () => false,
    );

    const handleAction = React.useCallback(
      (e: React.MouseEvent, action: (() => void) | undefined) => {
        e.preventDefault();
        e.stopPropagation();
        action?.();
      },
      [],
    );

    const filteredActions = React.useMemo(
      () =>
        ActionItems.filter(
          (item) =>
            (isLink || !item.isLink) &&
            (item.key !== "onCopy" || copyingAvailable),
        ),
      [isLink, copyingAvailable],
    );

    return (
      <ActionWrapper contentEditable={false}>
        {filteredActions.map(({ key, icon, tooltip }) => (
          <ActionButton
            key={key}
            icon={icon}
            tooltip={tooltip}
            onClick={(e) => handleAction(e, actions[key])}
          />
        ))}
      </ActionWrapper>
    );
  },
);

ImageActions.displayName = "ImageActions";
