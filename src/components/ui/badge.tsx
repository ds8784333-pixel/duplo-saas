import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info";
const colors: Record<Variant, string> = {
  default: "bg-muted text-foreground",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger:  "bg-red-500/15 text-red-300 border-red-500/30",
  info:    "bg-sky-500/15 text-sky-300 border-sky-500/30",
};

export const Badge = ({ variant = "default", className, ...p }: { variant?: Variant } & React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold", colors[variant], className)} {...p} />
);
