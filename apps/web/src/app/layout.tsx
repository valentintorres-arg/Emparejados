import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Proveedores } from "@/components/proveedores";
import { Pwa } from "@/components/pwa";
import pantallasIos from "@/lib/pantallas-ios.json";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: { default: "Emparejados Pádel", template: "%s | Emparejados Pádel" },
  description: "Jugadores, parejas, torneos y partidos de pádel en un solo lugar.",
  applicationName: "Emparejados",
  appleWebApp: {
    capable: true,
    title: "Emparejados",
    statusBarStyle: "default",
    // iOS muestra una pantalla en blanco al abrir la app instalada, salvo que haya una
    // imagen del tamaño exacto del teléfono (scripts/generar-iconos.mjs las genera).
    startupImage: pantallasIos.map(({ ancho, alto, escala }) => ({
      url: `/arranque/iphone-${ancho}x${alto}@${escala}.png`,
      media: `(device-width: ${ancho}px) and (device-height: ${alto}px) and (-webkit-device-pixel-ratio: ${escala}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1846a3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Pwa />
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
