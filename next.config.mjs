/** @type {import('next').NextConfig} */
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
            value:
              "frame-ancestors 'self' https://odds-sable.vercel.app https://*.vercel.app",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
