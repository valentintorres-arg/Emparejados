"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Arranque } from "@/components/arranque";
import { useSesion } from "@/lib/sesion";

/** Puerta de entrada: manda a cada quien a su pantalla de inicio. */
export default function Inicio() {
  const router = useRouter();
  const { usuario, esAdmin } = useSesion();

  useEffect(() => {
    if (usuario === undefined) return;
    router.replace(usuario === null ? "/login" : esAdmin ? "/admin" : "/panel");
  }, [usuario, esAdmin, router]);

  return <Arranque />;
}
