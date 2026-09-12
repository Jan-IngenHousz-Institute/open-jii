"use client";

import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Command as CommandPrimitive } from "cmdk";
import * as React from "react";

import { cn } from "../lib/utils";
import { Dialog, DialogContent } from "./dialog";

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandDialog = ({
  children,
  commandProps,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  /** Props forwarded to the inner <Command> (e.g. `shouldFilter`, controlled `value`). */
  commandProps?: React.ComponentPropsWithoutRef<typeof Command>;
}) => {
  return (
    <Dialog {...props}>
      {/* DialogContent's close is positioned against its default p-6, which this
          sets to p-0, so it would land mid-search-row over the typed text. */}
      <DialogContent showCloseButton={false} className="overflow-hidden p-0">
        {/* One inset for the whole dialog, so the magnifier sits on the item-icon
            rail; icon sizes come from the components' own size-4. cmdk puts a
            plain-block [cmdk-list-sizer] between the list and its children, so a
            status message needs both to be flex columns to fill the space. */}
        <Command
          className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]]:h-12 [&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2 [&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:flex-1 [&_[cmdk-list-sizer]]:flex-col [&_[cmdk-list]]:flex [&_[cmdk-list]]:flex-col"
          {...commandProps}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex h-9 items-center gap-2 border-b px-3" cmdk-input-wrapper="">
    <MagnifyingGlassIcon className="size-4 shrink-0 opacity-50" />
    {/* Height from the wrapper: an h-10 input in an h-9 row overflowed the
        border it sits above. */}
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "placeholder:text-muted-foreground outline-hidden flex h-full w-full rounded-md bg-transparent py-0 text-sm disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
      className,
    )}
    {...props}
  />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("bg-border -mx-1 h-px", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "outline-hidden data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
