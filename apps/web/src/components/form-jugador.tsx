"use client";

import { useState } from "react";
import useSWR from "swr";
import { mensajeDe, traer } from "@/lib/api";
import type { Catalogos, Jugador } from "@/lib/tipos";
import { Boton, Campo, ErrorDeFormulario, Selector } from "./ui";

export interface DatosDeJugador {
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string;
  genero: string;
  telefono: string;
  localidadId: number | null;
  clubId: number | null;
  categoriaId: number;
  manoHabil: string;
  posicion: string;
}

export interface DatosDeCuenta {
  email: string;
  password?: string;
  consentimiento: boolean;
}

interface Props {
  /** registro: lo completa el propio jugador. alta: lo carga la organización. edicion: datos ya existentes. */
  modo: "registro" | "alta" | "edicion";
  inicial?: Jugador;
  /** En edición, solo la organización cambia DNI y categoría. */
  esAdmin?: boolean;
  textoDelBoton: string;
  alEnviar: (datos: DatosDeJugador & Partial<DatosDeCuenta>) => Promise<void>;
}

const numero = (valor: FormDataEntryValue | null) => (valor ? Number(valor) : null);

export function FormularioJugador({ modo, inicial, esAdmin = false, textoDelBoton, alEnviar }: Props) {
  const { data: catalogos } = useSWR<Catalogos>("/catalogos", traer);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const conCuenta = modo !== "edicion";
  const bloqueado = modo === "edicion" && !esAdmin;

  const enviar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    const texto = (campo: string) => String(f.get(campo) ?? "");
    setError(null);
    setEnviando(true);
    try {
      await alEnviar({
        nombre: texto("nombre"),
        apellido: texto("apellido"),
        dni: bloqueado ? inicial!.dni : texto("dni"),
        fechaNacimiento: texto("fechaNacimiento"),
        genero: texto("genero"),
        telefono: texto("telefono"),
        localidadId: numero(f.get("localidadId")),
        clubId: numero(f.get("clubId")),
        categoriaId: bloqueado ? inicial!.categoria.id : Number(f.get("categoriaId")),
        manoHabil: texto("manoHabil"),
        posicion: texto("posicion"),
        ...(conCuenta && {
          email: texto("email"),
          consentimiento: f.get("consentimiento") === "on",
          ...(modo === "registro" && { password: texto("password") }),
        }),
      });
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-6">
      {conCuenta && (
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="titulo mb-3 text-xl">Cuenta</legend>
          <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required className={modo === "alta" ? "sm:col-span-2" : ""} />
          {modo === "registro" && (
            <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="new-password" minLength={8} required ayuda="Al menos 8 caracteres." />
          )}
        </fieldset>
      )}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="titulo mb-3 text-xl">Datos personales</legend>
        <Campo etiqueta="Nombre" name="nombre" autoComplete="given-name" defaultValue={inicial?.nombre} maxLength={60} required />
        <Campo etiqueta="Apellido" name="apellido" autoComplete="family-name" defaultValue={inicial?.apellido} maxLength={60} required />
        <Campo
          etiqueta="DNI"
          name="dni"
          inputMode="numeric"
          pattern="[0-9.]{7,10}"
          defaultValue={inicial?.dni}
          disabled={bloqueado}
          required
          ayuda={bloqueado ? "Si hay un error, pedile a la organización que lo corrija." : "Solo números. Nunca aparece en tu QR."}
        />
        <Campo etiqueta="Fecha de nacimiento" name="fechaNacimiento" type="date" defaultValue={inicial?.fechaNacimiento.slice(0, 10)} required />
        <Selector
          etiqueta="Género"
          name="genero"
          defaultValue={inicial?.genero ?? ""}
          vacio="Elegí"
          required
          opciones={[["MASCULINO", "Masculino"], ["FEMENINO", "Femenino"], ["OTRO", "Otro"]]}
        />
        <Campo etiqueta="Teléfono o WhatsApp" name="telefono" type="tel" autoComplete="tel" defaultValue={inicial?.telefono} required ayuda="Con código de área, por ejemplo 341 555 1234." />
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="titulo mb-3 text-xl">Datos de juego</legend>
        <Selector
          key={`categoria-${catalogos ? "lista" : "espera"}`}
          etiqueta="Categoría"
          name="categoriaId"
          defaultValue={inicial?.categoria.id ?? ""}
          vacio="Elegí"
          disabled={bloqueado}
          required
          opciones={(catalogos?.categorias ?? []).map((c) => [c.id, c.nombre] as const)}
        />
        <Selector
          key={`club-${catalogos ? "lista" : "espera"}`}
          etiqueta="Club"
          name="clubId"
          defaultValue={inicial?.club?.id ?? ""}
          vacio="Sin club"
          opciones={(catalogos?.clubes ?? []).map((c) => [c.id, `${c.nombre} (${c.localidad.nombre})`] as const)}
        />
        <Selector
          key={`localidad-${catalogos ? "lista" : "espera"}`}
          etiqueta="Ciudad"
          name="localidadId"
          defaultValue={inicial?.localidad?.id ?? ""}
          vacio="Sin especificar"
          opciones={(catalogos?.localidades ?? []).map((l) => [l.id, `${l.nombre}, ${l.provincia}`] as const)}
        />
        <Selector
          etiqueta="Mano hábil"
          name="manoHabil"
          defaultValue={inicial?.manoHabil ?? "DERECHA"}
          opciones={[["DERECHA", "Derecha"], ["IZQUIERDA", "Izquierda"]]}
        />
        <Selector
          etiqueta="Posición preferida"
          name="posicion"
          defaultValue={inicial?.posicion ?? "DRIVE"}
          opciones={[["DRIVE", "Drive"], ["REVES", "Revés"]]}
        />
      </fieldset>

      {conCuenta && (
        <label className="flex items-start gap-3 rounded-md border border-linea bg-white p-4 text-sm">
          <input type="checkbox" name="consentimiento" required className="mt-0.5 size-5 shrink-0 accent-pista" />
          <span>
            {modo === "registro"
              ? "Acepto que Emparejados guarde y use mis datos personales para organizar torneos de pádel, según la Ley 25.326 de Protección de Datos Personales. Puedo pedir que los corrijan o los den de baja cuando quiera."
              : "El jugador dio su consentimiento para que se guarden y usen sus datos personales, según la Ley 25.326."}
          </span>
        </label>
      )}

      <ErrorDeFormulario mensaje={error} />
      <Boton type="submit" cargando={enviando} className="w-full sm:w-auto">
        {textoDelBoton}
      </Boton>
    </form>
  );
}
