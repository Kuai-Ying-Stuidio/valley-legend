import * as React from "react";

import { cn } from "@/lib/utils";

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export function Separator({
  className,
  orientation = "horizontal",
  role = "separator",
  ...props
}: SeparatorProps) {
  return (
    <div
      role={role}
      aria-orientation={orientation}
      className={cn(
        "bg-border/80",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
