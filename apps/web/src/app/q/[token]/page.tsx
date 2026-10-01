import { redirect } from "next/navigation";

/**
 * Destino del QR de un jugador cuando se lee con la cámara del teléfono:
 * abre la pantalla de armar pareja con ese código ya cargado.
 */
export default async function AbrirQr({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  redirect(`/parejas/escanear?codigo=${encodeURIComponent(token)}`);
}
