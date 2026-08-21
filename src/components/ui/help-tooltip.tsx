"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpTooltipProps {
  /** The explanation shown on hover / focus / tap */
  children: React.ReactNode;
  /** Optional: widen or narrow the popover, defaults to a readable measure */
  side?: "top" | "right" | "bottom" | "left" | undefined; 
  className?: string;
}

export function HelpTooltip({ children, side, className }: HelpTooltipProps) {
  return (
    <Tooltip>
        <TooltipTrigger asChild>
            <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="More information"
            >
            <HelpCircle className="h-3.5 w-3.5" />
            </button>
        </TooltipTrigger>
        <TooltipContent side={side} className={className ?? "max-w-xs text-sm"}>
            {children}
        </TooltipContent>
    </Tooltip>
  );
}