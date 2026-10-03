"use client";

import jsQR from "jsqr";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

/** El QR lleva un enlace a /q/<token>: así también funciona con la cámara del teléfono. */
export const enlaceDeQr = (token: string) => `${window.location.origin}/q/${token}`;

/** Acepta el enlace completo o el token pelado y devuelve el token. */
export function tokenDeTexto(texto: string): string | null {
  const limpio = texto.trim();
  // El token es base64url y puede terminar en "-" o "_": el corte no puede ser \b, que lo recortaría.
  const enEnlace = /\/q\/([A-Za-z0-9_-]{16,64})(?![A-Za-z0-9_-])/.exec(limpio)?.[1];
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

// El lector nativo de códigos (Chrome en Android) todavía no figura en los tipos de TypeScript.
interface LectorNativo {
  detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface ClaseDeLectorNativo {
  new (opciones: { formats: string[] }): LectorNativo;
  getSupportedFormats?: () => Promise<string[]>;
}

/** Usa el lector del sistema si lee QR: es más rápido y aguanta mejor reflejos y pantallas. */
async function lectorNativo(): Promise<LectorNativo | null> {
  const Clase = (window as unknown as { BarcodeDetector?: ClaseDeLectorNativo }).BarcodeDetector;
  if (!Clase) return null;
  try {
    const formatos = await Clase.getSupportedFormats?.();
    if (formatos && !formatos.includes("qr_code")) return null;
    return new Clase({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

/** Mientras el mismo código siga frente a la cámara, se avisa una sola vez cada este tiempo. */
const ESPERA_ENTRE_AVISOS = 3000;

/**
 * Cámara que busca códigos QR. Avisa con el token cuando lee uno de Emparejados y
 * con alLeerAjeno cuando lee cualquier otro. Sigue mirando hasta que se la saca de
 * la pantalla: si el código leído no sirve, se puede probar con otro sin recargar.
 */
export function EscanerQr({ alLeer, alLeerAjeno }: { alLeer: (token: string) => void; alLeerAjeno?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<EstadoDeCamara>("pidiendo");
  const avisos = useRef({ alLeer, alLeerAjeno });
  useEffect(() => {
    avisos.current = { alLeer, alLeerAjeno };
  }, [alLeer, alLeerAjeno]);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let cuadro = 0;
    let activo = true;
    let nativo: LectorNativo | null = null;
    let ultimo = { texto: "", cuando: 0 };
    const lienzo = document.createElement("canvas");
    const pincel = lienzo.getContext("2d", { willReadFrequently: true });

    const leer = async (): Promise<string | null> => {
      const elemento = video.current;
      if (!elemento || elemento.readyState < 2 || elemento.videoWidth === 0) return null;
      if (nativo) {
        try {
          const [codigo] = await nativo.detect(elemento);
          return codigo?.rawValue ?? null;
        } catch {
          nativo = null; // Si el lector del sistema falla, se sigue con jsQR.
        }
      }
      if (!pincel) return null;
      // 720 px del lado mayor alcanzan para leer un QR en otra pantalla sin trabar el teléfono.
      const escala = Math.min(1, 720 / Math.max(elemento.videoWidth, elemento.videoHeight));
      lienzo.width = Math.round(elemento.videoWidth * escala);
      lienzo.height = Math.round(elemento.videoHeight * escala);
      pincel.drawImage(elemento, 0, 0, lienzo.width, lienzo.height);
      const imagen = pincel.getImageData(0, 0, lienzo.width, lienzo.height);
      return jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: "dontInvert" })?.data ?? null;
    };

    const avisar = (texto: string) => {
      const ahora = Date.now();
      if (texto === ultimo.texto && ahora - ultimo.cuando < ESPERA_ENTRE_AVISOS) return;
      ultimo = { texto, cuando: ahora };
      const token = tokenDeTexto(texto);
      if (token) {
        navigator.vibrate?.(80);
        avisos.current.alLeer(token);
      } else {
        avisos.current.alLeerAjeno?.();
      }
    };

    const buscar = async () => {
      if (!activo) return;
      const texto = await leer();
      if (!activo) return;
      if (texto) avisar(texto);
      cuadro = window.setTimeout(buscar, nativo ? 120 : 200);
    };

    // Sin HTTPS o en navegadores viejos no existe mediaDevices: se trata igual que "no hay cámara".
    const pedido = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      : Promise.reject(new DOMException("Sin acceso a la cámara", "NotFoundError"));
    pedido
      .then(async (stream) => {
        if (!activo) {
          stream.getTracks().forEach((pista) => pista.stop());
          return;
        }
        flujo = stream;
        nativo = await lectorNativo();
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
        if (!activo) return;
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
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-tinta shadow-tarjeta">
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
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-lg text-white">
          {estado === "pidiendo" && "Abriendo la cámara…"}
          {estado === "sin-permiso" && "La cámara está bloqueada. Habilitala en los permisos del navegador o pegá el código más abajo."}
          {estado === "sin-camara" && "Este dispositivo no tiene una cámara disponible. Pegá el código más abajo."}
        </p>
      )}
    </div>
  );
}
