"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { EscanerQr, tokenDeTexto } from "@/components/qr";
import { Avatar, Boton, Campo, Encabezado, ErrorDeFormulario, Tarjeta } from "@/components/ui";
import { api, mensajeDe } from "@/lib/api";
import { nombreCompleto } from "@/lib/formato";
import type { JugadorBasico } from "@/lib/tipos";

type Paso =
  | { nombre: "escanear" }
  | { nombre: "confirmar"; token: string; jugador: JugadorBasico }
  | { nombre: "listo"; jugador: JugadorBasico };

function ArmarPareja() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  // Si se llegó leyendo el QR con la cámara del teléfono, el código viene en la dirección.
  const codigoInicial = useSearchParams().get("codigo");
  const [paso, setPaso] = useState<Paso>({ nombre: "escanear" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const buscar = async (token: string) => {
    setError(null);
    setOcupado(true);
    try {
      const jugador = await api.get<JugadorBasico>(`/jugadores/por-qr/${token}`);
      setPaso({ nombre: "confirmar", token, jugador });
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  };

  useEffect(() => {
    // setState diferido: evita actualizar durante el montaje.
    if (codigoInicial) queueMicrotask(() => buscar(codigoInicial));
  }, [codigoInicial]);

  const crear = async (token: string, jugador: JugadorBasico) => {
    setError(null);
    setOcupado(true);
    try {
      await api.post("/parejas", { token });
      await mutate("/parejas/mias");
      setPaso({ nombre: "listo", jugador });
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  };

  if (paso.nombre === "listo") {
    return (
      <Tarjeta className="mx-auto max-w-md p-6 text-center">
        <Avatar jugador={paso.jugador} className="mx-auto size-20 text-2xl" />
        <h2 className="titulo mt-4 text-3xl">Propuesta enviada</h2>
        <ol className="mx-auto mt-5 max-w-xs space-y-3 text-left">
          <li className="flex items-start gap-3">
            <span className="marcador flex size-7 shrink-0 items-center justify-center rounded-full bg-pista-50 text-lg text-pista">1</span>
            {paso.jugador.nombre} la confirma desde su cuenta.
          </li>
          <li className="flex items-start gap-3">
            <span className="marcador flex size-7 shrink-0 items-center justify-center rounded-full bg-pista-50 text-lg text-pista">2</span>
            La organización la aprueba.
          </li>
          <li className="flex items-start gap-3">
            <span className="marcador flex size-7 shrink-0 items-center justify-center rounded-full bg-pista-50 text-lg text-pista">3</span>
            Ya pueden inscribirse juntos en un torneo.
          </li>
        </ol>
        <Boton className="mt-6 w-full" onClick={() => router.push("/parejas")}>
          Ver mis parejas
        </Boton>
      </Tarjeta>
    );
  }

  if (paso.nombre === "confirmar") {
    const { jugador, token } = paso;
    return (
      <Tarjeta className="mx-auto max-w-md p-6 text-center">
        <Avatar jugador={jugador} className="mx-auto size-20 text-2xl" />
        <h2 className="titulo mt-4 text-3xl">{nombreCompleto(jugador)}</h2>
        <p className="mt-1.5 text-lg text-gris">
          {jugador.categoria.nombre} categoría{jugador.club ? `, ${jugador.club.nombre}` : ""}
        </p>
        <div className="mt-5 space-y-3">
          <ErrorDeFormulario mensaje={error} />
          <Boton className="w-full" cargando={ocupado} onClick={() => crear(token, jugador)}>
            Armar pareja con {jugador.nombre}
          </Boton>
          <Boton
            className="w-full"
            variante="secundario"
            onClick={() => {
              setError(null);
              setPaso({ nombre: "escanear" });
            }}
          >
            No es la persona, escanear de nuevo
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <EscanerQr alLeer={buscar} />
      <p className="text-center text-lg">Apuntá al código QR que tu compañero tiene en la pantalla de inicio de su cuenta.</p>
      <ErrorDeFormulario mensaje={error} />
      <form
        className="flex flex-col gap-3 border-t border-linea pt-6 sm:flex-row sm:items-end"
        onSubmit={(evento) => {
          evento.preventDefault();
          const token = tokenDeTexto(String(new FormData(evento.currentTarget).get("codigo") ?? ""));
          if (token) buscar(token);
          else setError("Ese código no tiene el formato de un QR de Emparejados.");
        }}
      >
        <Campo etiqueta="¿Sin cámara? Pegá el código o el enlace" name="codigo" className="flex-1" autoComplete="off" required />
        <Boton type="submit" variante="secundario" cargando={ocupado}>
          Buscar
        </Boton>
      </form>
    </div>
  );
}

export default function PaginaDeEscaneo() {
  return (
    <>
      <Encabezado titulo="Armar pareja" volver="/parejas" />
      <Suspense>
        <ArmarPareja />
      </Suspense>
    </>
  );
}
