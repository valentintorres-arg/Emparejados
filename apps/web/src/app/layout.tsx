import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Proveedores } from "@/components/proveedores";
import { Pwa } from "@/components/pwa";
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
  appleWebApp: { capable: true, title: "Emparejados", statusBarStyle: "default" },
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
