/** @type {import('next').NextConfig} */

// frame-ancestors libera o(s) dominio(s) do Duplo Pro pra embed via iframe.
// Adicione novos hosts via env NEXT_PUBLIC_DUPLO_PRO_URL + FRAME_ANCESTORS_EXTRA
// (lista separada por espacos), sem precisar mexer no codigo quando o dominio
// custom for configurado.
function frameAncestors() {
  const base = ["'self'", "https://*.vercel.app"];
  if (process.env.NEXT_PUBLIC_DUPLO_PRO_URL) base.push(process.env.NEXT_PUBLIC_DUPLO_PRO_URL);
  if (process.env.FRAME_ANCESTORS_EXTRA) base.push(...process.env.FRAME_ANCESTORS_EXTRA.split(/\s+/));
  return Array.from(new Set(base)).join(" ");
}

const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  // Permite embed em iframe pelo Duplo Pro (botao ADM).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors()}`,
          },
        ],
      },
    ];
  },
};
export default nextConfig;
