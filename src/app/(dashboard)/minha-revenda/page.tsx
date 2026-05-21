"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Home, Upload, MessageSquare, Copy } from "lucide-react";
import { toast } from "sonner";

const MAX = 1024 * 1024;
// URL do Duplo Pro — o link gerado e a "porta" da conta filha:
// abre o scanner com a marca/logo do admin e sem o botao ADM.
const DUPLO_PRO_URL = "https://odds-sable.vercel.app";

// Normaliza slug: lowercase, troca espacos/underscore por hifen, remove o
// resto que nao for [a-z0-9-], colapsa hifens consecutivos e trim de hifens.
function normalizeSlug(raw: string) {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function MinhaRevendaPage() {
  const [profile, setProfile] = useState({ brandName: "", brandSlug: "", logoUrl: "", whatsapp: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await fetch("/api/auth/me");
    const j = await r.json();
    setProfile({
      brandName: j.resellerProfile?.brandName || j.name || "",
      brandSlug: j.resellerProfile?.brandSlug || "",
      logoUrl: j.resellerProfile?.logoUrl || "",
      whatsapp: j.resellerProfile?.whatsapp || "",
    });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Apenas imagens.");
    if (f.size > MAX) return toast.error("Imagem muito grande (máx 1 MB).");
    const reader = new FileReader();
    reader.onload = (ev) => setProfile((p) => ({ ...p, logoUrl: String(ev.target?.result || "") }));
    reader.readAsDataURL(f);
  }

  async function save() {
    const cleanSlug = normalizeSlug(profile.brandSlug);
    if (!cleanSlug) return toast.error("Defina um slug valido (letras, numeros e hifens).");
    const body = { ...profile, brandSlug: cleanSlug };
    const r = await fetch("/api/auth/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return toast.error(d.error || "Falha ao salvar");
    }
    setProfile((p) => ({ ...p, brandSlug: cleanSlug }));
    toast.success("Alteracoes salvas.");
  }

  // Link da conta filha: abre o Duplo Pro com a marca/logo do admin aplicadas
  // e sem o botao ADM. Slug vazio = link incompleto (admin precisa definir).
  const safeSlug = normalizeSlug(profile.brandSlug);
  const link = safeSlug ? `${DUPLO_PRO_URL}/r/${safeSlug}` : "";

  if (loading) return <div className="p-6"><div className="h-6 w-40 bg-muted/40 rounded animate-pulse" /></div>;

  return (
    <div className="p-6 max-w-5xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center"><Home className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold">Minha revenda</h1>
          <p className="text-sm text-muted-foreground">Personalize nome, logo e link. As alterações aparecem para quem acessa pelo seu link.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-5">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Preview da marca</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted/30 grid place-items-center">
                {profile.logoUrl
                  ? <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" />
                  : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div>
                <div className="font-extrabold">{profile.brandName || "Sua marca"}</div>
                <div className="text-xs text-muted-foreground">Scanner de Pagamento Antecipado</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Link de acesso</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Compartilhe este link com seus clientes (abre o Duplo Pro com sua marca, sem o botao ADM):</p>
              <div className="flex gap-2">
                <Input readOnly value={link || "Defina um slug para gerar o link"} />
                <Button
                  variant="outline"
                  type="button"
                  disabled={!link}
                  onClick={() => { if (!link) return; navigator.clipboard.writeText(link); toast.success("Link copiado."); }}
                >
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Identidade</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold">Nome da revenda *</span>
                <Input value={profile.brandName} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Slug do link *</span>
                <Input
                  value={profile.brandSlug}
                  onChange={(e) => setProfile({ ...profile, brandSlug: e.target.value })}
                  onBlur={(e) => setProfile({ ...profile, brandSlug: normalizeSlug(e.target.value) })}
                  placeholder="minha-marca"
                />
                <span className="text-[11px] text-muted-foreground">Aparece no fim da URL: {DUPLO_PRO_URL}/r/{safeSlug || "minha-marca"}</span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm font-semibold cursor-pointer hover:bg-primary hover:text-primary-foreground transition">
                <Upload className="h-4 w-4" />
                {profile.logoUrl ? "Trocar imagem..." : "Selecionar imagem..."}
                <input type="file" accept="image/*" hidden onChange={onFile} />
              </label>
              <p className="text-xs text-muted-foreground">PNG, JPG, SVG, WebP ou GIF. Máx 1 MB.</p>
              <div className="flex items-center gap-3 p-2 border rounded-lg">
                <div className="h-9 w-16 rounded overflow-hidden bg-muted/30 grid place-items-center">
                  {profile.logoUrl ? <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] text-muted-foreground">sem logo</span>}
                </div>
                <span className="text-xs text-muted-foreground">Preview</span>
                {profile.logoUrl && (
                  <button onClick={() => setProfile({ ...profile, logoUrl: "" })} className="ml-auto text-xs text-primary underline">Remover</button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle><MessageSquare className="h-4 w-4 inline mr-1" /> WhatsApp de suporte</CardTitle></CardHeader>
            <CardContent>
              <label className="block">
                <span className="text-xs font-semibold">Número com DDD (somente dígitos)</span>
                <Input inputMode="numeric" value={profile.whatsapp || ""} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value.replace(/\D/g, "") })} placeholder="5511999999999" />
                <span className="text-[11px] text-muted-foreground">Exemplo: 5511999999999 (55 + DDD + número)</span>
              </label>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="gradient" onClick={save}>Salvar alterações</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
