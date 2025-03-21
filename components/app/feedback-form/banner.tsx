"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon, SendIcon } from "lucide-react";

export function FeedbackFormBanner({ onClick }: { onClick: () => void }) {
  // return (
  //   <div
  //     className="bg-background hover:ring-ring flex h-[45px] w-full cursor-text items-center justify-between rounded-md border px-3 shadow-sm hover:ring-1"
  //     onClick={onClick}
  //   >
  //     <p className="text-muted-foreground text-sm leading-5 font-normal">
  //       Any feedback? We’d love to hear from you!
  //     </p>
  //     <Button
  //       size="icon"
  //       className="mr-[-2] size-auto p-2"
  //       disabled={false}
  //       onClick={(e) => {
  //         e.preventDefault();
  //         onClick();
  //       }}
  //     >
  //       <SendIcon className="size-4" />
  //     </Button>
  //   </div>
  // );

  // return (
  //   <div
  //     className="bg-muted/50 flex h-[45px] w-full cursor-pointer items-center justify-between rounded-md border pr-1 pl-3 shadow-sm"
  //     onClick={onClick}
  //   >
  //     <p className="text-primary text-sm">
  //       Any Feedback? We’d love to hear from you!
  //     </p>
  //     <Button
  //       size="sm"
  //       onClick={(e) => {
  //         e.preventDefault();
  //         onClick();
  //       }}
  //     >
  //       <PlusIcon className="size-4"></PlusIcon>Share your feedback
  //     </Button>
  //   </div>
  // );

  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="text-muted-foreground bg-background hover:bg-background hover:text-muted-foreground hover:ring-ring h-fit w-full cursor-text justify-start p-3 text-sm leading-5 font-normal hover:ring-1"
    >
      Any feedback? We’d love to hear from you!
    </Button>
  );
}
