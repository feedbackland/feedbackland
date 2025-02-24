"use client";

export function FeedbackFormBanner({
  bannerText,
  onClick,
}: {
  bannerText: string;
  onClick: () => void;
}) {
  // return (
  //   <Input placeholder="Have an idea? Share it here!" className="w-full" />
  // );
  return (
    <div
      className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground shadow-sm transition-colors ease-out hover:border hover:border-primary"
      onClick={onClick}
    >
      {bannerText}
      {/* <Button size="sm">
        <PlusIcon className="size-4" />
        {buttonText}
      </Button> */}
    </div>
  );
}
