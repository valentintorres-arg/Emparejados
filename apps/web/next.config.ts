import type { NextConfig } from "next";

// La API de NestJS no se expone al navegador: Next la publica bajo /api en el
// mismo dominio, así las cookies de sesión son de primera parte y no hace falta CORS.
const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // La imagen de Docker se compila con STANDALONE=1; en desarrollo no hace falta.
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
  async headers() {
    return [
      {
        // El service worker no se cachea: cada visita trae la última versión.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
