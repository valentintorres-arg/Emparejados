"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Boton } from "./ui";

// El navegador avisa una sola vez que la app se puede instalar
// (beforeinstallprompt). Se guarda el aviso para ofrecer el botón más tarde.
interface AvisoDeInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let aviso: AvisoDeInstalacion | null = null;
const oyentes = new Set<() => void>();
const notificar = () => oyentes.forEach((oyente) => oyente());

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Va en el layout raíz: registra el service worker y escucha el aviso de instalación. */
export function Pwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la app funciona igual; solo no se puede instalar.
      });
    }
    const alPoderInstalar = (evento: Event) => {
      evento.preventDefault();
      aviso = evento as AvisoDeInstalacion;
      notificar();
    };
    const alInstalar = () => {
      aviso = null;
      notificar();
    };
    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);
  return null;
}

/** Botón "Instalar la app". Solo aparece cuando el navegador permite instalarla. */
export function InstalarApp({ claro = false, className }: { claro?: boolean; className?: string }) {
  const disponible = useSyncExternalStore(
    suscribir,
    () => aviso !== null,
    () => false,
  );
  if (!disponible) return null;

  const instalar = async () => {
    if (!aviso) return;
    await aviso.prompt();
    await aviso.userChoice;
    aviso = null;
    notificar();
  };

  return (
    <Boton variante={claro ? "claro" : "secundario"} onClick={instalar} icono="descargar" className={className}>
      Instalar la app
    </Boton>
  );
}
