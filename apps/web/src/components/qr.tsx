"use client";

import jsQR from "jsqr";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

/** El QR lleva un enlace a /q/<token>: así también funciona con la cámara del teléfono. */
export const enlaceDeQr = (token: string) => `${window.location.origin}/q/${token}`;

/** Acepta el enlace completo o el token pelado y devuelve el token. */
export function tokenDeTexto(texto: string): string | null {
  const limpio = texto.trim();
  const enEnlace = /\/q\/([A-Za-z0-9_-]{16,64})\b/.exec(limpio)?.[1];
  if (enEnlace) return enEnlace;
  return /^[A-Za-z0-9_-]{16,64}$/.test(limpio) ? limpio : null;
}

export function CodigoQr({ token, className = "" }: { token: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let vigente = true;
    QRCode.toString(enlaceDeQr(token), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0e1b3d", light: "#ffffff" } }).then(
      (resultado) => vigente && setSvg(resultado),
    );
    return () => {
      vigente = false;
    };
  }, [token]);
  // El SVG lo genera la librería a partir del token propio: no hay contenido de terceros.
  return <div role="img" aria-label="Tu código QR" className={`aspect-square ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

type EstadoDeCamara = "pidiendo" | "activa" | "sin-permiso" | "sin-camara";

/** Cámara que busca un QR de Emparejados y avisa con el token leído. */
export function EscanerQr({ alLeer }: { alLeer: (token: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<EstadoDeCamara>("pidiendo");
  const alLeerRef = useRef(alLeer);
  useEffect(() => {
    alLeerRef.current = alLeer;
  }, [alLeer]);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let cuadro = 0;
    let activo = true;
    const lienzo = document.createElement("canvas");
    const pincel = lienzo.getContext("2d", { willReadFrequently: true });

    const buscar = () => {
      if (!activo) return;
      const elemento = video.current;
      if (elemento && pincel && elemento.readyState >= 2 && elemento.videoWidth > 0) {
        // Con 480 px de ancho alcanza para leer el QR y no se traba el teléfono.
        const escala = Math.min(1, 480 / elemento.videoWidth);
        lienzo.width = Math.round(elemento.videoWidth * escala);
        lienzo.height = Math.round(elemento.videoHeight * escala);
        pincel.drawImage(elemento, 0, 0, lienzo.width, lienzo.height);
        const imagen = pincel.getImageData(0, 0, lienzo.width, lienzo.height);
        const leido = jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: "dontInvert" });
        const token = leido && tokenDeTexto(leido.data);
        if (token) {
          activo = false;
          navigator.vibrate?.(80);
          alLeerRef.current(token);
          return;
        }
      }
      cuadro = window.setTimeout(buscar, 180);
    };

    // Sin HTTPS o en navegadores viejos no existe mediaDevices: se trata igual que "no hay cámara".
    const pedido = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      : Promise.reject(new DOMException("Sin acceso a la cámara", "NotFoundError"));
    pedido
      .then(async (stream) => {
        if (!activo) {
          stream.getTracks().forEach((pista) => pista.stop());
          return;
        }
        flujo = stream;
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
        setEstado("activa");
        buscar();
      })
      .catch((error: DOMException) => setEstado(error.name === "NotAllowedError" ? "sin-permiso" : "sin-camara"));

    return () => {
      activo = false;
      window.clearTimeout(cuadro);
      flujo?.getTracks().forEach((pista) => pista.stop());
    };
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-tinta">
      <video ref={video} muted playsInline className="size-full object-cover" aria-label="Vista de la cámara" />
      {estado === "activa" ? (
        // Marco de encuadre: cuatro esquinas, como las líneas de la cancha.
        <div aria-hidden="true" className="pointer-events-none absolute inset-[14%]">
          <span className="absolute left-0 top-0 size-9 rounded-tl-md border-l-4 border-t-4 border-pelota" />
          <span className="absolute right-0 top-0 size-9 rounded-tr-md border-r-4 border-t-4 border-pelota" />
          <span className="absolute bottom-0 left-0 size-9 rounded-bl-md border-b-4 border-l-4 border-pelota" />
          <span className="absolute bottom-0 right-0 size-9 rounded-br-md border-b-4 border-r-4 border-pelota" />
        </div>
      ) : (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
          {estado === "pidiendo" && "Abriendo la cámara…"}
          {estado === "sin-permiso" && "La cámara está bloqueada. Habilitala en los permisos del navegador o pegá el código más abajo."}
          {estado === "sin-camara" && "Este dispositivo no tiene una cámara disponible. Pegá el código más abajo."}
        </p>
      )}
    </div>
  );
}
