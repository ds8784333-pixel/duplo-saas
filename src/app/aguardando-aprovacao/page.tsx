// Tela mostrada quando uma RESELLER (mae) esta cadastrada mas o super-admin
// ainda nao liberou o acesso dela. Similar a tela "Quase la!" das contas
// filhas — mas no contexto da hierarquia super -> mae -> filhas.
"use client";
import { useEffect, useState } from "react";
import { Lock, RefreshCcw, LogOut } from "lucide-react";

export default function AguardandoAprovacao() {
  const [rechecking, setRechecking] = useState(false);
  const [me, setMe] = useState<{ email?: string; name?: string }>({});

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setMe({ email: j.email, name: j.name }))
      .catch(() => {});
  }, []);

  async function recheck() {
    setRechecking(true);
    // Espera um pouco pra dar feedback visual e tenta carregar /dashboard.
    // Se ainda nao tem sub ativa, o middleware/layout devolve pra ca.
    await new Promise((r) => setTimeout(r, 400));
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-22 h-22 rounded-full bg-emerald-500/15 grid place-items-center" style={{ width: 88, height: 88 }}>
          <Lock className="h-10 w-10 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight">Quase lá! Sua revenda está aguardando liberação</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            O administrador geral do Duplo Pro está revisando o seu cadastro.
            Assim que liberar, você poderá acessar o painel da sua revenda
            e começar a vender.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            Após a liberação, clique no botão abaixo para entrar.
          </p>
        </div>

        <button
          onClick={recheck}
          disabled={rechecking}
          className="w-full max-w-sm mx-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-emerald-500 text-black font-bold text-base hover:bg-emerald-400 transition shadow-[0_6px_24px_rgba(34,197,94,0.25)] disabled:opacity-70"
        >
          <RefreshCcw className={"h-5 w-5 " + (rechecking ? "animate-spin" : "")} />
          {rechecking ? "Verificando..." : "Já fui liberado — Entrar agora"}
        </button>

        <div className="text-[11px] text-muted-foreground">
          Conta: {me.email || "—"}
          {" · "}
          <form action="/api/auth/logout" method="POST" className="inline">
            <button type="submit" className="text-muted-foreground hover:text-foreground underline">trocar conta</button>
          </form>
        </div>
      </div>
    </div>
  );
}
