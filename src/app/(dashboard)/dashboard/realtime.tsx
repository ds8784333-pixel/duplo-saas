"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWS } from "@/hooks/use-ws";

export function DashboardRealtime({ userId }: { userId: string }) {
  const router = useRouter();
  const { last } = useWS<{ type: string; message?: string }>("wallet:" + userId);

  useEffect(() => {
    if (!last) return;
    if (last.type === "wallet.updated") {
      toast.message("Carteira atualizada", { description: last.message });
      router.refresh();
    }
  }, [last, router]);

  return null;
}
