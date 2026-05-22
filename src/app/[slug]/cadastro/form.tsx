"use client";
import { useState } from "react";
import Link from "next/link";
import { Zap, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DUPLO_PRO_URL } from "@/lib/config";

export default function BrandedSignupForm({
  brandName,
  brandSlug,
  logoUrl,
}: {
  brandName: string;
  brandSlug: string;
  logoUrl: string | null;
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, resellerSlug: brandSlug }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error || "Falha no cadastro");
      return;
    }
    toast.success("Conta criada!");
    // Volta pro Duplo Pro carregando o email: la o JS detecta que a conta
    // ainda nao tem acesso liberado e exibe a tela "Quase la".
    const next = `${DUPLO_PRO_URL}/r/${encodeURIComponent(brandSlug)}?email=${encodeURIComponent(form.email)}`;
    window.location.href = next;
  }

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border bg-card/60 backdrop-blur p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted/30 grid place-items-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandName} className="h-full w-full object-cover" />
            ) : (
              <Zap className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <div className="font-extrabold">{brandName || "Criar conta"}</div>
            <div className="text-xs text-muted-foreground">Cadastre-se em segundos</div>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold">Nome</span>
          <Input required value={form.name} onChange={set("name")} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold">E-mail</span>
          <Input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold">Senha (mín. 6)</span>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Criando..." : "Criar conta"}
        </Button>
        <div className="text-xs text-muted-foreground text-center">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary hover:underline">Entrar</Link>
        </div>
      </form>
    </div>
  );
}
