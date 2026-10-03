"use client";

import { useRef, useState } from "react";
import { api, mensajeDe } from "@/lib/api";
import { Avatar, Boton, useAviso, useConfirmar } from "./ui";

/** Lado del cuadrado en píxeles: alcanza para verse nítida en el avatar más grande, con pantalla de alta densidad. */
const LADO = 320;

/**
 * Recorta el centro de la imagen en un cuadrado, la achica y la comprime. Una
 * foto de 4 MB del teléfono queda en unos 20 KB. WebP si el navegador sabe
 * generarlo; si no (Safari viejo), JPG.
 */
async function prepararFoto(archivo: File): Promise<string> {
  const imagen = await createImageBitmap(archivo).catch(() => {
    throw new Error("No se pudo leer esa imagen. Probá con otra foto.");
  });
  const lado = Math.min(imagen.width, imagen.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = LADO;
  lienzo.height = LADO;
  const pincel = lienzo.getContext("2d")!;
  pincel.imageSmoothingQuality = "high";
  pincel.drawImage(imagen, (imagen.width - lado) / 2, (imagen.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  imagen.close();

  const generar = (tipo: string, calidad: number) => new Promise<Blob | null>((listo) => lienzo.toBlob(listo, tipo, calidad));
  let blob = await generar("image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await generar("image/jpeg", 0.85);
  if (!blob) throw new Error("No se pudo preparar la foto. Probá con otra.");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

/**
 * Foto de perfil del jugador: la cambia él mismo (Mis datos) o la organización
 * (ficha). En el celular, elegir archivo ofrece también sacar una foto.
 */
export function CambiarFoto({
  jugador,
  alCambiar,
}: {
  jugador: { id: number; nombre: string; apellido: string; fotoUrl: string | null };
  alCambiar: () => void;
}) {
  const avisar = useAviso();
  const confirmar = useConfirmar();
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setOcupado(true);
    try {
      await api.put(`/jugadores/${jugador.id}/foto`, { imagen: await prepararFoto(archivo) });
      alCambiar();
      avisar("Foto guardada.");
    } catch (error) {
      avisar(mensajeDe(error), "mal");
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const quitar = async () => {
    if (!(await confirmar({ titulo: "¿Quitar la foto?", texto: "En su lugar se van a ver las iniciales.", confirmar: "Quitar foto" }))) return;
    setOcupado(true);
    try {
      await api.del(`/jugadores/${jugador.id}/foto`);
      alCambiar();
      avisar("Foto quitada.");
    } catch (error) {
      avisar(mensajeDe(error), "mal");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar jugador={jugador} className="size-28 text-3xl" />
      <input ref={entrada} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => subir(e.target.files?.[0])} />
      <div className="flex flex-wrap justify-center gap-2">
        <Boton tamano="chico" variante="secundario" icono="camara" cargando={ocupado} onClick={() => entrada.current?.click()}>
          {jugador.fotoUrl ? "Cambiar foto" : "Subir foto"}
        </Boton>
        {jugador.fotoUrl && (
          <Boton tamano="chico" variante="fantasma" disabled={ocupado} onClick={quitar}>
            Quitar
          </Boton>
        )}
      </div>
    </div>
  );
}
