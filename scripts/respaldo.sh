#!/bin/sh
# Respaldo diario de la base de Emparejados (cron en /etc/cron.d/emparejados-respaldo).
# Guarda 30 días en /opt/emparejados/respaldos. Cómo instalarlo y cómo restaurar:
# sección 10 de CONTEXTO.txt.
set -eu
umask 077
cd /opt/emparejados
mkdir -p respaldos
archivo="respaldos/emparejados-$(date +%Y%m%d-%H%M).sql.gz"

# El usuario y la base los conoce el contenedor (POSTGRES_USER y POSTGRES_DB del .env).
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' | gzip > "$archivo.tmp"

# Si pg_dump se corta, gzip igual termina bien: un volcado entero cierra con esta línea.
if ! gzip -dc "$archivo.tmp" | tail -n 5 | grep -q 'PostgreSQL database dump complete'; then
  rm -f "$archivo.tmp"
  echo "$(date '+%F %T') El respaldo quedó incompleto y se descartó." >&2
  exit 1
fi

mv "$archivo.tmp" "$archivo"
find respaldos -name 'emparejados-*.sql.gz' -mtime +30 -delete
echo "$(date '+%F %T') Respaldo listo: $archivo ($(du -h "$archivo" | cut -f1))"
