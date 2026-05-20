"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || "Falha no cadastro");
      return;
    }
    toast.success("Conta criada!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border bg-card/60 backdrop-blur p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center"><Zap className="h-5 w-5" /></div>
          <div>
            <div className="font-extrabold">Criar conta</div>
            <div className="text-xs text-muted-foreground">Comece a vender em minutos</div>
          </div>
        </div>

        <label className="block"><span className="text-xs font-semibold">Nome</span><Input required value={form.name} onChange={set("name")} /></label>
        <label className="block"><span className="text-xs font-semibold">E-mail</span><Input type="email" required value={form.email} onChange={set("email")} autoComplete="email" /></label>
        <label className="block"><span className="text-xs font-semibold">Senha (mín. 6)</span><Input type="password" required minLength={6} value={form.password} onChange={set("password")} autoComplete="new-password" /></label>

        <Button type="submit" disabled={loading} className="w-full">{loading ? "Criando..." : "Criar conta"}</Button>
        <div className="text-xs text-muted-foreground text-center">
          Já tem conta? <Link href="/login" className="text-primary hover:underline">Entrar</Link>
        </div>
      </form>
    </div>
  );
}
