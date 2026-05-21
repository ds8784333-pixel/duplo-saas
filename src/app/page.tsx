import { redirect } from "next/navigation";

// Login removido — entrada do app vai direto pro painel ADM (Minha revenda).
export default function Home() {
  redirect("/minha-revenda");
}
