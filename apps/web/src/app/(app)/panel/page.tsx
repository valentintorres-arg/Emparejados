"use client";

import Link from "next/link";
import useSWR from "swr";
import { TarjetaPartido } from "@/components/competencia";
import { EsqueletoPartidos } from "@/components/esqueletos";
import { TarjetaDePareja } from "@/components/parejas";
import { InstalarApp } from "@/components/pwa";
import { ActivarNotificaciones } from "@/components/notificaciones";
import { CodigoQr, enlaceDeQr } from "@/components/qr";
import { Boton, Encabezado, Estado, FalloDeCarga, Seccion, Tarjeta, TARJETA_ENLACE, useAccion, useAviso, useConfirmar, Vacio } from "@/components/ui";
import { api, traer } from "@/lib/api";
import { ESTADOS_INSCRIPCION, nombreDePareja, rangoDeFechas } from "@/lib/formato";
import { useSesion } from "@/lib/sesion";
import type { Inscripcion, Pareja, Partido, TorneoResumen } from "@/lib/tipos";

type MiInscripcion = Inscripcion & { torneo: TorneoResumen };

function MiQr() {
  const { data: qr, error, mutate } = useSWR<{ token: string }>("/jugadores/yo/qr", traer);
  const { ejecutar, enCurso } = useAccion();
  const confirmar = useConfirmar();
  const avisar = useAviso();

  const regenerar = async () => {
    const seguro = await confirmar({
      titulo: "¿Generar un código nuevo?",
      texto: "El código actual deja de funcionar: quien lo tenga guardado ya no va a poder usarlo.",
      confirmar: "Generar código",
    });
    if (seguro && (await ejecutar("qr", () => api.post("/jugadores/yo/qr/regenerar"), "Listo, tenés un código nuevo."))) mutate();
  };

  const copiar = async () => {
    if (!qr) return;
    await navigator.clipboard.writeText(enlaceDeQr(qr.token));
    avisar("Enlace copiado. Mandáselo a tu compañero.");
  };

  return (
    <Tarjeta className="overflow-hidden lg:flex">
      <div className="flex flex-col items-center gap-3 bg-pista px-6 py-7 text-white lg:w-80">
        <p className="text-center text-lg font-semibold">Tu código de jugador</p>
        <div className="w-full max-w-64 rounded-2xl bg-white p-4">
          {qr ? <CodigoQr token={qr.token} /> : <div className="aspect-square animate-pulse rounded-lg bg-linea" />}
        </div>
        <p className="text-center text-white/90">Mostráselo a tu compañero</p>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-5 p-5 sm:p-6">
        <div>
          <h2 className="titulo text-2xl">Armá pareja en tres pasos</h2>
          <ol className="mt-3 space-y-2.5">
            {["Uno de los dos escanea el código del otro.", "El otro confirma desde su cuenta.", "La organización aprueba la pareja."].map((paso, i) => (
              <li key={paso} className="flex items-start gap-3">
                <span className="marcador flex size-7 shrink-0 items-center justify-center rounded-full bg-pista-50 text-lg text-pista">{i + 1}</span>
                {paso}
              </li>
            ))}
          </ol>
        </div>
        {error && <FalloDeCarga error={error} reintentar={() => mutate()} />}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <Boton href="/parejas/escanear" icono="camara">
            Escanear el código de mi compañero
          </Boton>
          <Boton variante="secundario" disabled={!qr} onClick={copiar}>
            Copiar mi enlace
          </Boton>
          <Boton variante="fantasma" cargando={enCurso === "qr"} onClick={regenerar}>
            Generar un código nuevo
          </Boton>
        </div>
      </div>
    </Tarjeta>
  );
}

export default function PanelDelJugador() {
  const { usuario } = useSesion();
  const jugador = usuario!.jugador!;
  const { data: parejas } = useSWR<Pareja[]>("/parejas/mias", traer);
  const { data: partidos } = useSWR<Partido[]>("/partidos/mios", traer);
  const { data: inscripciones } = useSWR<MiInscripcion[]>("/inscripciones/mias", traer);

  const invitaciones = parejas?.filter((p) => p.estado === "PENDIENTE" && p.creadaPorId !== jugador.id) ?? [];
  const proximos = partidos?.filter((p) => p.ganadorId === null).slice(0, 3);
  const enTorneos = inscripciones?.filter((i) => ["INSCRIPCION_ABIERTA", "EN_CURSO"].includes(i.torneo.estado) && i.estado !== "BAJA");

  return (
    <>
      <Encabezado
        titulo={`Hola, ${jugador.nombre}`}
        detalle={`${jugador.categoria.nombre} categoría${jugador.club ? `, ${jugador.club.nombre}` : ""}`}
      >
        <InstalarApp className="lg:hidden" />
      </Encabezado>

      <ActivarNotificaciones soloSiFaltan className="mb-8" />

      {invitaciones.length > 0 && (
        <Seccion titulo="Te propusieron armar pareja">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {invitaciones.map((pareja) => (
              <TarjetaDePareja key={pareja.id} pareja={pareja} miId={jugador.id} />
            ))}
          </div>
        </Seccion>
      )}

      <section className="mb-9">
        <MiQr />
      </section>

      <Seccion
        titulo="Tus próximos partidos"
        accion={
          <Boton href="/partidos" tamano="chico" variante="fantasma">
            Ver todos
          </Boton>
        }
      >
        {!proximos ? (
          <EsqueletoPartidos cantidad={2} />
        ) : proximos.length === 0 ? (
          <Vacio titulo="No tenés partidos por jugar">Cuando tu pareja entre al fixture de un torneo, los partidos aparecen acá con día, hora y cancha.</Vacio>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {proximos.map((partido) => (
              <TarjetaPartido key={partido.id} partido={partido} contexto={partido.torneo?.nombre} />
            ))}
          </div>
        )}
      </Seccion>

      {enTorneos && enTorneos.length > 0 && (
        <Seccion titulo="Tus torneos">
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {enTorneos.map((inscripcion) => (
              <li key={inscripcion.id}>
                <Link href={`/torneos/${inscripcion.torneo.id}`} className={`block h-full p-5 ${TARJETA_ENLACE}`}>
                  <Estado valor={ESTADOS_INSCRIPCION[inscripcion.estado]} />
                  <span className="titulo mt-2.5 block text-xl">{inscripcion.torneo.nombre}</span>
                  <span className="mt-1.5 block text-gris">
                    {rangoDeFechas(inscripcion.torneo.fechaInicio, inscripcion.torneo.fechaFin)}, {inscripcion.torneo.sede.nombre}
                  </span>
                  <span className="mt-1 block font-semibold">Con {nombreDePareja(inscripcion.pareja)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </>
  );
}
