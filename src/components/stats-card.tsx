"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Color = "emerald" | "cyan" | "violet" | "amber" | "slate" | "rose";
const palette: Record<Color, string> = {
  emerald: "from-emerald-500/30 to-emerald-500/0 ring-emerald-500/40",
  cyan:    "from-cyan-500/30 to-cyan-500/0 ring-cyan-500/40",
  violet:  "from-violet-500/30 to-violet-500/0 ring-violet-500/40",
  amber:   "from-amber-500/30 to-amber-500/0 ring-amber-500/40",
  slate:   "from-slate-500/25 to-slate-500/0 ring-slate-500/30",
  rose:    "from-rose-500/30 to-rose-500/0 ring-rose-500/40",
};

export function StatsCard({
  label, value, color = "amber",
}: { label: string; value: React.ReactNode; color?: Color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("relative rounded-2xl border p-4 bg-gradient-to-br ring-1", palette[color])}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-extrabold text-foreground">{value}</div>
    </motion.div>
  );
}
