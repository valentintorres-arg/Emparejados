"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { fechaYHora } from "@/lib/formato";
import { Boton, Dialogo, Icono, useAccion, useAviso, useConfirmar } from "./ui";

export interface CodigoGenerado {
  codigo: string;
  email: string;
  venceEn: string;
}

/** El código grande, para dictarlo o copiarlo, con las instrucciones para quien lo recibe. */
export function MostrarCodigo({ codigo, email, venceEn }: CodigoGenerado) {
  const avisar = useAviso();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      avisar("Código copiado.");
    } catch {
      avisar("No se pudo copiar: anotalo a mano.", "mal");
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-pista-50 p-4">
        <span className="marcador select-all text-5xl tracking-wider text-pista">{codigo}</span>
        <Boton tamano="chico" variante="secundario" onClick={copiar}>
          Copiar
        </Boton>
      </div>
      <ol className="space-y-2.5">
        {[
          `Entrá a la app y tocá "¿Olvidaste tu contraseña?" en la pantalla de ingreso.`,
          `Escribí el email ${email}, este código y una contraseña nueva.`,
        ].map((paso, i) => (
          <li key={paso} className="flex items-start gap-3">
            <span className="marcador flex size-7 shrink-0 items-center justify-center rounded-full bg-pista text-lg text-white">{i + 1}</span>
            <span className="break-words">{paso}</span>
          </li>
        ))}
      </ol>
      <p className="rounded-xl border-2 border-aviso/30 bg-aviso-50 px-4 py-3 font-semibold text-aviso">
        Sirve una sola vez y vence el {fechaYHora(venceEn)}. Pasalo ahora: no se vuelve a mostrar.
      </p>
    </div>
  );
}

/** Botón de la organización: genera un código para que un jugador elija una contraseña nueva. */
export function BotonCodigoPassword({ usuarioId, quien, tamano = "normal" }: { usuarioId: number; quien: string; tamano?: "normal" | "chico" }) {
  const confirmar = useConfirmar();
  const { ejecutar, enCurso } = useAccion();
  const [generado, setGenerado] = useState<CodigoGenerado | null>(null);

  const generar = async () => {
    const seguro = await confirmar({
      titulo: "¿Generar un código para la contraseña?",
      texto: `${quien} lo usa una sola vez para elegir una contraseña nueva. Si tenía otro código sin usar, deja de servir.`,
      confirmar: "Generar código",
    });
    if (!seguro) return;
    await ejecutar("codigo", async () => setGenerado(await api.post<CodigoGenerado>(`/usuarios/${usuarioId}/codigo-password`)));
  };

  return (
    <>
      <Boton tamano={tamano} variante="secundario" cargando={enCurso === "codigo"} onClick={generar}>
        <Icono nombre="llave" className="size-[1.25em] shrink-0" />
        Código para la contraseña
      </Boton>
      <Dialogo abierto={generado !== null} cerrar={() => setGenerado(null)} titulo={`Código para ${quien}`}>
        {generado && <MostrarCodigo {...generado} />}
        <Boton className="mt-6 w-full" onClick={() => setGenerado(null)}>
          Listo, ya lo pasé
        </Boton>
      </Dialogo>
    </>
  );
}
