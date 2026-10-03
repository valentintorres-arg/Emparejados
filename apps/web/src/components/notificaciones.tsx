"use client";

import { useEffect, useState } from "react";
import { activarNotificaciones, desactivarNotificaciones, type EstadoDeNotificaciones, estadoDeNotificaciones } from "@/lib/notificaciones";
import { Boton, Icono, Tarjeta, useAviso } from "./ui";

/**
 * Ofrece activar las notificaciones en este dispositivo. Con `soloSiFaltan`
 * desaparece cuando ya están activadas (pantallas de inicio); sin él muestra
 * también el estado y la opción de desactivarlas (Mis datos).
 */
export function ActivarNotificaciones({ soloSiFaltan = false, className = "" }: { soloSiFaltan?: boolean; className?: string }) {
  const avisar = useAviso();
  const [estado, setEstado] = useState<EstadoDeNotificaciones>("cargando");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vigente = true;
    estadoDeNotificaciones()
      .catch((): EstadoDeNotificaciones => "no-disponible")
      .then((actual) => vigente && setEstado(actual));
    return () => {
      vigente = false;
    };
  }, []);

  if (estado === "cargando" || estado === "no-disponible") return null;
  if (soloSiFaltan && estado === "activado") return null;

  const activar = async () => {
    setOcupado(true);
    try {
      const nuevo = await activarNotificaciones();
      setEstado(nuevo);
      if (nuevo === "activado") avisar("Listo: te vamos a avisar en este teléfono.");
    } catch {
      avisar("No se pudieron activar las notificaciones. Probá de nuevo.", "mal");
    } finally {
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    setOcupado(true);
    await desactivarNotificaciones();
    setOcupado(false);
    setEstado("apagado");
    avisar("Notificaciones desactivadas en este teléfono.");
  };

  if (estado === "activado") {
    return (
      <Tarjeta className={`flex flex-wrap items-center justify-between gap-3 p-4 ${className}`}>
        <p className="flex items-center gap-2.5 font-semibold text-ok">
          <Icono nombre="campana" className="size-6" />
          Notificaciones activadas en este teléfono
        </p>
        <Boton tamano="chico" variante="secundario" cargando={ocupado} onClick={desactivar}>
          Desactivar
        </Boton>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className={`flex flex-col gap-4 border-pista/30 bg-pista-50 p-5 sm:flex-row sm:items-center ${className}`}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pista text-white">
        <Icono nombre="campana" className="size-6" />
      </span>
      <div className="flex-1">
        <h2 className="titulo text-xl">Enterate al instante</h2>
        <p className="mt-1 text-gris">
          {estado === "apagado" && "Te avisamos en este teléfono cuando te propongan pareja, cuando la organización apruebe y cuando tengas partido."}
          {estado === "bloqueado" &&
            "Las notificaciones están bloqueadas para este sitio. Habilitalas en los permisos del navegador (el candado al lado de la dirección) y volvé a esta pantalla."}
          {estado === "instalar-primero" &&
            "En iPhone, las notificaciones funcionan con la app instalada: tocá Compartir, después “Agregar a inicio”, y abrila desde ese ícono."}
        </p>
      </div>
      {estado === "apagado" && (
        <Boton icono="campana" cargando={ocupado} onClick={activar} className="sm:shrink-0">
          Activar notificaciones
        </Boton>
      )}
    </Tarjeta>
  );
}
