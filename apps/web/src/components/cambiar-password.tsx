"use client";

import { useState } from "react";
import { api, mensajeDe } from "@/lib/api";
import { Boton, Campo, ErrorDeFormulario, useAviso } from "./ui";

/**
 * Cambio de la propia contraseña. Con `provisoria` (a la persona se la
 * blanquearon y acaba de entrar con ella) la actual es esa, y la nueva se
 * escribe dos veces porque es la que va a quedar.
 */
export function CambiarPassword({ provisoria = false, alTerminar }: { provisoria?: boolean; alTerminar?: () => unknown }) {
  const avisar = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={async (evento) => {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        const f = new FormData(formulario);
        if (provisoria && f.get("nueva") !== f.get("repetida")) {
          setError("Las dos contraseñas no son iguales. Escribilas de nuevo.");
          return;
        }
        setError(null);
        setEnviando(true);
        try {
          await api.post("/auth/password", { actual: f.get("actual"), nueva: f.get("nueva") });
          formulario.reset();
          avisar(provisoria ? "Listo: ya tenés tu contraseña." : "Contraseña cambiada.");
          await alTerminar?.();
        } catch (e) {
          setError(mensajeDe(e));
        } finally {
          setEnviando(false);
        }
      }}
    >
      <Campo
        etiqueta={provisoria ? "Contraseña provisoria" : "Contraseña actual"}
        name="actual"
        type="password"
        autoComplete="current-password"
        required
        ayuda={provisoria ? "La que te pasaron, con la que acabás de entrar." : undefined}
        className={provisoria ? "sm:col-span-2" : ""}
      />
      <Campo etiqueta="Contraseña nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} required ayuda="Al menos 8 caracteres." />
      {provisoria && <Campo etiqueta="Repetí la contraseña nueva" name="repetida" type="password" autoComplete="new-password" minLength={8} required />}
      <div className="space-y-3 sm:col-span-2">
        <ErrorDeFormulario mensaje={error} />
        <Boton type="submit" variante={provisoria ? "primario" : "secundario"} cargando={enviando}>
          {provisoria ? "Guardar mi contraseña" : "Cambiar contraseña"}
        </Boton>
      </div>
    </form>
  );
}
