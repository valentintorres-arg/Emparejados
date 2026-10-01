import type { MetadataRoute } from "next";

// Con este manifest y el service worker (public/sw.js), Chrome y Edge ofrecen
// instalar la app en Android y en escritorio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Emparejados Pádel",
    short_name: "Emparejados",
    description: "Jugadores, parejas, torneos y partidos de pádel en un solo lugar.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eef2f8",
    theme_color: "#1846a3",
    categories: ["sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mi QR", url: "/panel", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Torneos", url: "/torneos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
