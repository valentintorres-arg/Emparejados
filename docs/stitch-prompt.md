# Prompts para Stitch

Stitch rinde mejor con un prompt base (contexto y sistema de diseño) y después
una pantalla por pedido. El bloque 0 va primero; los demás, de a uno, en el
mismo proyecto.

## 0. Base (pegar primero)

```
Diseñá "Emparejados Pádel", una app web instalable (PWA) para organizar
competencias de pádel amateur en clubes de Argentina: jugadores, parejas,
torneos y partidos. Se usa sobre todo en el celular, al aire libre, al costado
de la cancha.

Regla central del producto: las parejas las arman los propios jugadores
escaneando el QR del compañero, pero nada queda activo hasta que la
organización lo aprueba. Lo mismo vale para las inscripciones a torneos. Los
estados (pendiente, confirmada, activa, rechazada, en espera) tienen que leerse
de un vistazo.

Roles: visitante (ve los torneos sin cuenta), jugador y organización.

SISTEMA DE DISEÑO
- Solo tema claro, con contraste alto para leer al sol. Sin modo oscuro, sin
  degradados, sin efecto vidrio.
- Colores: azul pista #1846a3 (primario: barras de navegación y botones), azul
  oscuro #0c2357, azul muy claro #e8eefb, tinta #0e1b3d (texto), gris #55627d
  (texto secundario), fondo #eef2f8, bordes #d3dbe9, tarjetas blancas.
- Amarillo pelota #d9f03f SOLO para marcar al ganador de un partido, lo que se
  está jugando ahora y los contadores de pendientes. Nunca como fondo general
  ni como color de botón.
- Estados: verde #146c48 sobre #e0f3ea (aprobado, activa), rojo #b02d23 sobre
  #fbe9e7 (rechazado, peligro), ámbar #7d4a00 sobre #fcefd8 (pendiente, en
  espera).
- Tipografía Archivo. Títulos y números del marcador en negrita condensada,
  como un tablero de resultados, con cifras tabulares. Texto corrido en ancho
  normal.
- Tarjetas blancas con borde de 1 px y radio de 8 px, sin sombras pesadas.
  Botones de 44 px de alto como mínimo: primario azul, secundario con borde,
  fantasma y peligro en rojo.
- Celular: barra superior azul con el logo y barra inferior blanca con cinco
  destinos (ícono y texto). Escritorio: menú lateral azul fijo de 240 px y
  contenido de hasta 1024 px de ancho.
- Textos en castellano rioplatense, con voseo y en voz activa ("Armá tu
  pareja", "Cargá el resultado", "Anotate"). Sin lorem ipsum: usá nombres,
  clubes y torneos argentinos creíbles.

COMPONENTES QUE SE REPITEN
- Tarjeta de partido: las dos parejas una sobre otra, los sets en columnas, la
  pareja ganadora en negrita con un punto amarillo; arriba la instancia
  (Zona A, Cuartos, Semifinal, Final); abajo día, hora, cancha y estado
  (Programado, En juego, Finalizado, Suspendido, W.O.).
- Etiqueta de estado en forma de píldora.
- Tarjeta de pareja: dos círculos con iniciales, nombres, categoría de cada
  uno y estado.
- Estado vacío: una frase que explica qué hacer para que aparezca contenido.

Empezá por la pantalla "Inicio del jugador" en celular:
saludo "Hola, Bruno" con "6ª categoría, Club Náutico"; una tarjeta "Te
propusieron armar pareja" con botones Confirmar y Declinar; una tarjeta grande
con fondo azul y el código QR del jugador sobre blanco, título "Armá pareja en
dos pasos" y botones "Escanear un QR", "Copiar mi enlace" y "Generar un código
nuevo"; la sección "Tus próximos partidos" con dos tarjetas de partido y el
enlace "Ver todos"; la sección "Tus torneos" con nombre, fechas, sede, estado
de la inscripción y "Con Acosta / Benítez". Barra inferior: Inicio, Parejas,
Partidos, Torneos, Mis datos.
```

## Pantallas del jugador (celular)

1. **Parejas.** `Pantalla "Parejas": lista de mis parejas agrupadas por estado. Pendiente (espera que el otro confirme, con botón "Declinar" o "Confirmar" según quién la propuso), Confirmada (espera a la organización), Activa (con botón "Disolver"), y un historial plegado de rechazadas (con el motivo) y disueltas. Arriba, botón primario "Escanear un QR". Estado vacío: "Todavía no tenés pareja".`
2. **Escanear.** `Pantalla "Escanear un QR": visor de cámara cuadrado con marco de esquinas y la frase "Apuntá al código de tu compañero". Debajo, alternativa "¿No funciona la cámara? Pegá el código o el enlace" con un campo y el botón "Buscar". Estado siguiente: tarjeta con el jugador encontrado (iniciales, nombre, categoría, club) y botón "Proponer pareja".`
3. **Partidos.** `Pantalla "Partidos": mis partidos en dos grupos, "Por jugar" y "Jugados", con la tarjeta de partido y el nombre del torneo arriba de cada una. El partido en juego va primero, con borde amarillo.`
4. **Mis datos.** `Pantalla "Mis datos": ficha del jugador (nombre, apellido, DNI, fecha de nacimiento, género, teléfono o WhatsApp, categoría, club, ciudad, mano hábil, posición preferida) en modo lectura con botón "Editar"; sección "Contraseña" con contraseña actual y nueva; botón "Instalar la app" y "Cerrar sesión".`

## Pantallas públicas

5. **Torneos.** `Pantalla "Torneos" (celular y escritorio): lista de torneos en tarjetas con nombre, categoría y rama (5ª caballeros, 7ª mixto), formato (Eliminación directa, Zonas y llaves, Todos contra todos), fechas, sede y localidad, estado en píldora (Inscripción abierta, En curso, Finalizado) y "12 de 16 parejas". Filtros por estado arriba. Sin sesión, la barra superior muestra el botón "Ingresar".`
6. **Torneo: Fixture.** `Pantalla de un torneo en curso, "Torneo Aniversario": encabezado con flecha para volver, nombre, "5ª caballeros · Zonas y llaves", fechas y sede, estado. Pestañas Fixture, Llave, Posiciones, Parejas y Reglamento. Pestaña Fixture activa: partidos agrupados por día ("Sábado 10 de octubre") con tarjetas de partido.`
7. **Torneo: Llave.** `Misma pantalla, pestaña Llave: cuadro de eliminación con columnas Cuartos, Semifinal y Final unidas por líneas finas, desplazable en horizontal en el celular. Cada casillero muestra las dos parejas y los sets; el ganador en negrita con punto amarillo. Arriba, banda azul "Campeones" con el nombre de la pareja y un círculo amarillo.`
8. **Torneo: Posiciones.** `Misma pantalla, pestaña Posiciones: una tabla por zona (Zona A, Zona B) con columnas pareja, PJ, PG, sets a favor y en contra, diferencia de games y puntos. Las dos primeras filas, que clasifican, con una marca azul a la izquierda. Al pie: "Partido ganado suma 2 puntos; perdido, 1; no presentarse, 0."`
9. **Torneo: Parejas.** `Misma pantalla con inscripción abierta, pestaña Parejas: arriba, tarjeta azul claro "Anotate en este torneo" con el cierre de inscripción y el botón "Inscribirme con Martín"; debajo, lista "Inscriptas (12)" con cabeza de serie en un círculo azul, nombres y categorías.`
10. **Ingreso.** `Pantallas "Ingresar" y "Crear tu cuenta" (celular): logo sobre fondo azul arriba y formulario en tarjeta blanca. Ingresar: email, contraseña, botón "Ingresar" y enlace "Crear tu cuenta". Crear cuenta: email, contraseña, nombre, apellido, DNI, fecha de nacimiento, género, teléfono, categoría, club, ciudad, mano hábil, posición preferida y una casilla obligatoria de consentimiento de datos personales (Ley 25.326).`
11. **Sin conexión.** `Pantalla "Sin conexión": ilustración simple de una pelota de pádel, "No hay señal" y botón "Reintentar".`

## Pantallas de la organización

12. **Inicio (escritorio y celular).** `Pantalla "Organización": menú lateral azul con Inicio, Aprobaciones (con globo amarillo "5"), Torneos, Jugadores, Sedes, Usuarios y Auditoría. Contenido: sección "Esperan tu decisión" con dos tarjetas grandes de números (parejas por aprobar, inscripciones por aprobar); sección "Torneos abiertos" con avance de cupo; sección "Todo lo demás" con accesos a Sedes, Usuarios y Auditoría.`
13. **Aprobaciones.** `Pantalla "Aprobaciones": dos pestañas, Parejas e Inscripciones. Cada fila muestra la pareja (iniciales, nombres, categorías, clubes), cuándo se pidió y, en inscripciones, el torneo y el cupo. Botones "Aprobar" y "Rechazar". Incluí el diálogo "Rechazar a Acosta / Benítez" con un campo de motivo obligatorio.`
14. **Jugadores.** `Pantalla "Jugadores" (escritorio): buscador por nombre, apellido o DNI, filtros por categoría y club, tabla con iniciales, nombre, DNI, categoría, club y teléfono, paginación y botón "Nuevo jugador". Segunda pantalla: ficha de un jugador con sus datos, su pareja actual, el historial de parejas y de torneos, y botones "Editar" y "Dar de baja".`
15. **Torneo nuevo.** `Pantalla "Nuevo torneo": formulario en dos columnas con nombre del torneo, sede, categoría, rama (Caballeros, Damas, Mixto), formato, empieza, termina, cierre de inscripción, cupo de parejas y reglamento (texto largo). Botones "Guardar" y "Cancelar".`
16. **Gestión del torneo.** `Pantalla del torneo vista por la organización: arriba de las pestañas, tarjeta azul claro "Gestión del torneo" con una frase guía ("Quedan 4 partidos sin día ni cancha.") y botones "Armar la agenda", "Generar llaves" y "Finalizar torneo". En el Fixture cada tarjeta de partido suma "Empezó", "Suspender", "Horario" y "Cargar resultado". Incluí el diálogo "Cargar resultado": las dos parejas en filas, tres columnas de sets con campos numéricos grandes, opción "No se presentó" y botón "Guardar resultado".`
17. **Sedes, usuarios y auditoría (escritorio).** `Tres pantallas de administración con la misma grilla: "Sedes" (clubes con su localidad y sus canchas, alta en línea), "Usuarios" (email, rol Organización o Jugador, activo, botón "Restablecer contraseña") y "Auditoría" (tabla de solo lectura con fecha, usuario, acción y detalle, con filtros).`
