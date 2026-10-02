/** Isotipo: una cancha vista desde arriba con dos pelotas del mismo lado, la pareja. */
export function Isotipo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="10" fill="#1846a3" />
      <rect x="9" y="7" width="30" height="34" rx="2" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M9 24h30M24 7v8M24 33v8" stroke="#fff" strokeWidth="2.5" />
      <circle cx="18" cy="29.5" r="3.2" fill="#d9f03f" />
      <circle cx="30" cy="29.5" r="3.2" fill="#d9f03f" />
    </svg>
  );
}

export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Isotipo className="size-9 rounded-xl ring-1 ring-white/25" />
      <span className="marca text-[1.7rem]">Emparejados</span>
    </span>
  );
}

/** Cancha de pádel en planta, como ilustración de la pantalla de ingreso. */
export function Cancha({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 400" className={className} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <rect x="6" y="6" width="188" height="388" rx="3" />
      <path d="M6 200h188" strokeWidth="5" />
      <path d="M6 70h188M6 330h188M100 70v260" />
    </svg>
  );
}
