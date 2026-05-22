import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";

export default async function Home() {
  const s = await getSessionFromCookies();
  redirect(s ? "/dashboard" : "/login");
}
