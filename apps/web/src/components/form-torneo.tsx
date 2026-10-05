"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api, mensajeDe, traer } from "@/lib/api";
import { deInputLocal, FORMATOS, paraInputLocal, RAMAS } from "@/lib/formato";
import type { Catalogos, TorneoDetalle, TorneoResumen } from "@/lib/tipos";
import { EsqueletoFormulario } from "./esqueletos";
import { AreaDeTexto, Boton, Campo, ErrorDeFormulario, Selector } from "./ui";

export function FormularioTorneo({ inicial }: { inicial?: TorneoDetalle }) {
  const router = useRouter();
  const { data: catalogos } = useSWR<Catalogos>("/catalogos", traer);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!catalogos) return <EsqueletoFormulario campos={8} />;

  const guardar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    const datos = {
      nombre: f.get("nombre"),
      sedeId: Number(f.get("sedeId")),
      categoriaId: Number(f.get("categoriaId")),
      rama: f.get("rama"),
      formato: f.get("formato"),
      cupoMaximo: Number(f.get("cupoMaximo")),
      fechaInicio: f.get("fechaInicio"),
      fechaFin: f.get("fechaFin"),
      fechaLimiteInscripcion: deInputLocal(String(f.get("fechaLimiteInscripcion"))),
      reglamento: String(f.get("reglamento") ?? ""),
    };
    setError(null);
    setEnviando(true);
    try {
      const torneo = inicial ? await api.put<TorneoResumen>(`/torneos/${inicial.id}`, datos) : await api.post<TorneoResumen>("/torneos", datos);
      router.push(`/torneos/${torneo.id}`);
    } catch (e) {
      setError(mensajeDe(e));
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre del torneo" name="nombre" defaultValue={inicial?.nombre} minLength={3} maxLength={120} required className="sm:col-span-2" />
      <Selector
        etiqueta="Sede"
        name="sedeId"
        defaultValue={inicial?.sede.id ?? ""}
        vacio="Elegí"
        required
        opciones={catalogos.clubes.map((c) => [c.id, `${c.nombre} (${c.canchas.length} canchas)`] as const)}
      />
      <Selector etiqueta="Categoría" name="categoriaId" defaultValue={inicial?.categoria.id ?? ""} vacio="Elegí" required opciones={catalogos.categorias.map((c) => [c.id, c.nombre] as const)} />
      <Selector etiqueta="Rama" name="rama" defaultValue={inicial?.rama ?? "MASCULINO"} opciones={Object.entries(RAMAS)} />
      <Selector etiqueta="Formato" name="formato" defaultValue={inicial?.formato ?? "ZONAS_Y_LLAVES"} opciones={Object.entries(FORMATOS)} />
      <Campo etiqueta="Empieza" name="fechaInicio" type="date" defaultValue={inicial?.fechaInicio.slice(0, 10)} required />
      <Campo etiqueta="Termina" name="fechaFin" type="date" defaultValue={inicial?.fechaFin.slice(0, 10)} required />
      <Campo
        etiqueta="Cierre de inscripción"
        name="fechaLimiteInscripcion"
        type="datetime-local"
        defaultValue={inicial ? paraInputLocal(inicial.fechaLimiteInscripcion) : ""}
        required
        ayuda="Después de esta fecha solo la organización puede anotar parejas."
      />
      <Campo
        etiqueta="Cupo de parejas"
        name="cupoMaximo"
        type="number"
        min={2}
        max={64}
        defaultValue={inicial?.cupoMaximo ?? 16}
        required
        ayuda="Las que se anoten de más quedan en lista de espera."
      />
      <AreaDeTexto etiqueta="Reglamento" name="reglamento" defaultValue={inicial?.reglamento ?? ""} rows={6} maxLength={10000} className="sm:col-span-2" />
      <div className="space-y-3 sm:col-span-2">
        <ErrorDeFormulario mensaje={error} />
        <Boton type="submit" cargando={enviando}>
          {inicial ? "Guardar cambios" : "Crear torneo"}
        </Boton>
      </div>
    </form>
  );
}
