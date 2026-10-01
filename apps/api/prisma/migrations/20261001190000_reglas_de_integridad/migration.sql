-- Reglas de integridad que Prisma no puede expresar en schema.prisma:
-- restricciones CHECK, exclusión de horarios superpuestos y triggers.
-- Cada regla tiene nombre propio para que la API pueda traducir el error
-- (campo "constraint" del error de PostgreSQL) a un mensaje para el usuario.

-- ─── Catálogos ───────────────────────────────────────────────────────────────

ALTER TABLE "categorias"
  ADD CONSTRAINT "categorias_orden_positivo" CHECK (orden > 0);

-- ─── Usuarios y acceso ───────────────────────────────────────────────────────

ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_email_formato" CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

ALTER TABLE "sesiones"
  ADD CONSTRAINT "sesiones_vencimiento_posterior" CHECK (expira_en > creada_en);

-- ─── Jugadores ───────────────────────────────────────────────────────────────

ALTER TABLE "jugadores"
  ADD CONSTRAINT "jugadores_dni_formato" CHECK (dni ~ '^[0-9]{7,8}$'),
  ADD CONSTRAINT "jugadores_nombre_no_vacio" CHECK (btrim(nombre) <> '' AND btrim(apellido) <> ''),
  -- Formato E.164 sin espacios; la API normaliza antes de guardar.
  ADD CONSTRAINT "jugadores_telefono_formato" CHECK (telefono ~ '^\+?[0-9]{8,15}$'),
  ADD CONSTRAINT "jugadores_nacimiento_valido" CHECK (fecha_nacimiento >= DATE '1900-01-01'),
  ADD CONSTRAINT "jugadores_consentimiento_con_version" CHECK (btrim(consentimiento_version) <> '');

-- Mantiene jugadores.busqueda = "apellido nombre dni", en minúsculas y sin
-- acentos, que es lo que indexa el GIN de trigramas.
CREATE FUNCTION jugadores_actualizar_busqueda() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.busqueda := lower(public.unaccent(NEW.apellido || ' ' || NEW.nombre)) || ' ' || NEW.dni;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jugadores_busqueda
  BEFORE INSERT OR UPDATE OF nombre, apellido, dni, busqueda ON "jugadores"
  FOR EACH ROW EXECUTE FUNCTION jugadores_actualizar_busqueda();

ALTER TABLE "qr_tokens"
  ADD CONSTRAINT "qr_tokens_longitud_minima" CHECK (length(token) >= 32);

-- ─── Parejas ─────────────────────────────────────────────────────────────────

ALTER TABLE "parejas"
  -- Orden canónico: impide la pareja consigo mismo y la combinación invertida.
  ADD CONSTRAINT "parejas_orden_canonico" CHECK (jugador1_id < jugador2_id),
  ADD CONSTRAINT "parejas_creada_por_integrante" CHECK (creada_por_id IN (jugador1_id, jugador2_id)),
  ADD CONSTRAINT "parejas_confirmada_con_fecha" CHECK (estado NOT IN ('CONFIRMADA', 'ACTIVA') OR confirmada_en IS NOT NULL),
  -- Nada queda activo sin un administrador que lo haya aprobado.
  ADD CONSTRAINT "parejas_activa_con_aprobador" CHECK (estado <> 'ACTIVA' OR (resuelta_por_id IS NOT NULL AND resuelta_en IS NOT NULL)),
  ADD CONSTRAINT "parejas_rechazo_con_motivo" CHECK (estado <> 'RECHAZADA' OR btrim(coalesce(motivo_rechazo, '')) <> ''),
  ADD CONSTRAINT "parejas_disuelta_con_fecha" CHECK (estado <> 'DISUELTA' OR disuelta_en IS NOT NULL);

-- ─── Torneos e inscripciones ─────────────────────────────────────────────────

ALTER TABLE "torneos"
  ADD CONSTRAINT "torneos_fechas_ordenadas" CHECK (fecha_fin >= fecha_inicio),
  ADD CONSTRAINT "torneos_cupo_minimo" CHECK (cupo_maximo >= 2),
  ADD CONSTRAINT "torneos_nombre_no_vacio" CHECK (btrim(nombre) <> '');

ALTER TABLE "inscripciones"
  ADD CONSTRAINT "inscripciones_siembra_positiva" CHECK (siembra IS NULL OR siembra > 0),
  ADD CONSTRAINT "inscripciones_resuelta_por_admin" CHECK (estado NOT IN ('APROBADA', 'RECHAZADA') OR (resuelta_por_id IS NOT NULL AND resuelta_en IS NOT NULL)),
  ADD CONSTRAINT "inscripciones_rechazo_con_motivo" CHECK (estado <> 'RECHAZADA' OR btrim(coalesce(motivo_rechazo, '')) <> '');

-- Reglas de inscripción que dependen de otras filas:
--   1. solo se inscriben parejas activas;
--   2. un jugador no puede estar en dos parejas vigentes del mismo torneo;
--   3. las aprobadas no superan el cupo (el excedente va a EN_ESPERA).
-- El advisory lock serializa las inscripciones de un mismo torneo, así dos
-- transacciones simultáneas no pueden pasar la validación a la vez.
CREATE FUNCTION inscripciones_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_pareja   parejas%ROWTYPE;
  v_cupo     smallint;
  v_ocupados integer;
BEGIN
  IF NEW.estado NOT IN ('PENDIENTE', 'APROBADA', 'EN_ESPERA') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('inscripciones'), NEW.torneo_id);

  SELECT * INTO v_pareja FROM parejas WHERE id = NEW.pareja_id;

  IF v_pareja.estado IS DISTINCT FROM 'ACTIVA' THEN
    RAISE EXCEPTION 'La pareja % no está activa', NEW.pareja_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'inscripciones_pareja_activa';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM inscripciones i
    JOIN parejas p ON p.id = i.pareja_id
    WHERE i.torneo_id = NEW.torneo_id
      AND i.id <> NEW.id
      -- La misma pareja repetida la informa el UNIQUE (torneo_id, pareja_id).
      AND i.pareja_id <> NEW.pareja_id
      AND i.estado IN ('PENDIENTE', 'APROBADA', 'EN_ESPERA')
      AND (p.jugador1_id IN (v_pareja.jugador1_id, v_pareja.jugador2_id)
        OR p.jugador2_id IN (v_pareja.jugador1_id, v_pareja.jugador2_id))
  ) THEN
    RAISE EXCEPTION 'Un integrante de la pareja % ya está inscripto en el torneo % con otra pareja', NEW.pareja_id, NEW.torneo_id
      USING ERRCODE = 'unique_violation', CONSTRAINT = 'inscripciones_jugador_unico_por_torneo';
  END IF;

  IF NEW.estado = 'APROBADA' THEN
    SELECT cupo_maximo INTO v_cupo FROM torneos WHERE id = NEW.torneo_id;

    SELECT count(*) INTO v_ocupados
    FROM inscripciones
    WHERE torneo_id = NEW.torneo_id AND estado = 'APROBADA' AND id <> NEW.id;

    IF v_ocupados >= v_cupo THEN
      RAISE EXCEPTION 'El torneo % ya completó su cupo de % parejas', NEW.torneo_id, v_cupo
        USING ERRCODE = 'check_violation', CONSTRAINT = 'inscripciones_cupo_completo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER inscripciones_reglas
  BEFORE INSERT OR UPDATE OF estado, torneo_id, pareja_id ON "inscripciones"
  FOR EACH ROW EXECUTE FUNCTION inscripciones_validar();

-- ─── Partidos ────────────────────────────────────────────────────────────────

ALTER TABLE "partidos"
  ADD CONSTRAINT "partidos_parejas_distintas" CHECK (pareja1_id <> pareja2_id),
  ADD CONSTRAINT "partidos_ganador_participa" CHECK (ganador_id IS NULL OR ganador_id IN (pareja1_id, pareja2_id)),
  -- Hay ganador si y solo si el partido terminó (jugado o por W.O.).
  ADD CONSTRAINT "partidos_ganador_si_terminado" CHECK ((estado IN ('FINALIZADO', 'WO')) = (ganador_id IS NOT NULL)),
  ADD CONSTRAINT "partidos_en_juego_con_parejas" CHECK (estado IN ('PROGRAMADO', 'SUSPENDIDO') OR (pareja1_id IS NOT NULL AND pareja2_id IS NOT NULL)),
  -- Un partido de zona tiene zona; uno de llave, no.
  ADD CONSTRAINT "partidos_zona_segun_instancia" CHECK ((instancia = 'ZONA') = (zona_id IS NOT NULL)),
  ADD CONSTRAINT "partidos_horario_completo" CHECK ((inicio IS NULL) = (fin IS NULL)),
  ADD CONSTRAINT "partidos_horario_ordenado" CHECK (fin > inicio),
  ADD CONSTRAINT "partidos_llave_completa" CHECK ((siguiente_partido_id IS NULL) = (siguiente_slot IS NULL)),
  ADD CONSTRAINT "partidos_llave_slot_valido" CHECK (siguiente_slot IN (1, 2)),
  ADD CONSTRAINT "partidos_llave_no_recursiva" CHECK (siguiente_partido_id <> id),
  ADD CONSTRAINT "partidos_llave_fuera_de_zona" CHECK (siguiente_partido_id IS NULL OR instancia <> 'ZONA'),
  ADD CONSTRAINT "partidos_numero_positivo" CHECK (numero > 0),
  -- Dos partidos no pueden ocupar la misma cancha en horarios superpuestos.
  -- Los suspendidos y los W.O. liberan el turno.
  ADD CONSTRAINT "partidos_cancha_sin_superposicion"
    EXCLUDE USING gist (cancha_id WITH =, tstzrange(inicio, fin) WITH &&)
    WHERE (estado IN ('PROGRAMADO', 'EN_JUEGO', 'FINALIZADO'));

ALTER TABLE "sets"
  ADD CONSTRAINT "sets_numero_valido" CHECK (nro_set BETWEEN 1 AND 3),
  ADD CONSTRAINT "sets_super_tiebreak_solo_tercero" CHECK (NOT super_tiebreak OR nro_set = 3),
  -- Set normal: 6-0 a 6-4, 7-5 o 7-6. Super tie-break: a 10 con diferencia de 2.
  ADD CONSTRAINT "sets_resultado_valido" CHECK (
    games_p1 >= 0 AND games_p2 >= 0 AND
    CASE
      WHEN super_tiebreak THEN
        greatest(games_p1, games_p2) >= 10
        AND abs(games_p1 - games_p2) >= 2
        AND (greatest(games_p1, games_p2) = 10 OR abs(games_p1 - games_p2) = 2)
      ELSE
        (greatest(games_p1, games_p2) = 6 AND least(games_p1, games_p2) <= 4)
        OR (greatest(games_p1, games_p2) = 7 AND least(games_p1, games_p2) IN (5, 6))
    END
  );

-- ─── Auditoría ───────────────────────────────────────────────────────────────

-- El registro de auditoría es de solo inserción.
CREATE FUNCTION auditoria_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El registro de auditoría no se puede modificar ni borrar'
    USING ERRCODE = 'restrict_violation', CONSTRAINT = 'auditoria_solo_insercion';
END;
$$;

CREATE TRIGGER auditoria_solo_insercion
  BEFORE UPDATE OR DELETE ON "auditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
