import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fl:data-[state=open]:animate-in fl:data-[state=closed]:animate-out fl:data-[state=closed]:fade-out-0 fl:data-[state=open]:fade-in-0 fl:fixed fl:inset-0 fl:z-50 fl:bg-black/50",
        className
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "fl:group/drawer-content fl:bg-background fl:fixed fl:z-50 fl:flex fl:h-auto fl:flex-col",
          "fl:data-[vaul-drawer-direction=top]:inset-x-0 fl:data-[vaul-drawer-direction=top]:top-0 fl:data-[vaul-drawer-direction=top]:mb-24 fl:data-[vaul-drawer-direction=top]:max-h-[80vh] fl:data-[vaul-drawer-direction=top]:rounded-b-lg fl:data-[vaul-drawer-direction=top]:border-b",
          "fl:data-[vaul-drawer-direction=bottom]:inset-x-0 fl:data-[vaul-drawer-direction=bottom]:bottom-0 fl:data-[vaul-drawer-direction=bottom]:mt-24 fl:data-[vaul-drawer-direction=bottom]:max-h-[80vh] fl:data-[vaul-drawer-direction=bottom]:rounded-t-lg fl:data-[vaul-drawer-direction=bottom]:border-t",
          "fl:data-[vaul-drawer-direction=right]:inset-y-0 fl:data-[vaul-drawer-direction=right]:right-0 fl:data-[vaul-drawer-direction=right]:w-3/4 fl:data-[vaul-drawer-direction=right]:border-l fl:data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "fl:data-[vaul-drawer-direction=left]:inset-y-0 fl:data-[vaul-drawer-direction=left]:left-0 fl:data-[vaul-drawer-direction=left]:w-3/4 fl:data-[vaul-drawer-direction=left]:border-r fl:data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        <div className="fl:bg-muted fl:mx-auto fl:mt-4 fl:hidden fl:h-2 fl:w-[100px] fl:shrink-0 fl:rounded-full fl:group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "fl:flex fl:flex-col fl:gap-0.5 fl:p-4 fl:group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center fl:group-data-[vaul-drawer-direction=top]/drawer-content:text-center fl:md:gap-1.5 fl:md:text-left",
        className
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "fl:mt-auto fl:flex fl:flex-col fl:gap-2 fl:p-4",
        className
      )}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("fl:text-foreground fl:font-semibold", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("fl:text-muted-foreground fl:text-sm", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
