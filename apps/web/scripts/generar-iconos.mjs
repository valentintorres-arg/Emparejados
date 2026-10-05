// Genera los íconos de la app instalable a partir de un único dibujo.
//   node scripts/generar-iconos.mjs
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const AZUL = "#1846a3";
const PELOTA = "#d9f03f";

/**
 * Isotipo: cancha en planta con dos pelotas del mismo lado (la pareja).
 * `margen` deja aire alrededor: los íconos "maskable" de Android se recortan
 * en círculo y solo el 80% central queda siempre visible.
 */
function isotipo({ redondeado, margen }) {
  const lado = 512;
  const escala = (lado - margen * 2) / 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
    <rect width="${lado}" height="${lado}" rx="${redondeado}" fill="${AZUL}"/>
    <g transform="translate(${margen} ${margen}) scale(${escala})" fill="none" stroke="#fff" stroke-width="2.6">
      <rect x="9" y="7" width="30" height="34" rx="2"/>
      <path d="M9 24h30M24 7v8M24 33v8"/>
      <circle cx="18" cy="29.5" r="3.2" fill="${PELOTA}" stroke="none"/>
      <circle cx="30" cy="29.5" r="3.2" fill="${PELOTA}" stroke="none"/>
    </g>
  </svg>`;
}

/**
 * Ícono chico de las notificaciones en la barra de estado de Android: el
 * sistema solo usa la transparencia, así que va en blanco sobre fondo vacío.
 */
const insignia = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 48 48">
  <g fill="none" stroke="#fff" stroke-width="3.4">
    <rect x="9" y="7" width="30" height="34" rx="2"/>
    <path d="M9 24h30M24 7v8M24 33v8"/>
  </g>
  <circle cx="18" cy="31" r="4" fill="#fff"/>
  <circle cx="30" cy="31" r="4" fill="#fff"/>
</svg>`);

const comun = Buffer.from(isotipo({ redondeado: 104, margen: 0 }));
const maskable = Buffer.from(isotipo({ redondeado: 0, margen: 70 }));
const cuadrado = Buffer.from(isotipo({ redondeado: 0, margen: 0 }));

await mkdir("public/icons", { recursive: true });
await sharp(comun).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(comun).resize(512).png().toFile("public/icons/icon-512.png");
await sharp(maskable).resize(512).png().toFile("public/icons/maskable-512.png");
await sharp(insignia).png().toFile("public/icons/insignia-96.png");
// Convenciones de Next: src/app/icon.png (favicon) y apple-icon.png (iPhone).
await sharp(comun).resize(64).png().toFile("src/app/icon.png");
await sharp(cuadrado).resize(180).png().toFile("src/app/apple-icon.png");

/**
 * Pantalla de arranque del iPhone. iOS no arma una con el ícono como Android:
 * muestra una imagen del tamaño exacto del teléfono (una por modelo, declaradas
 * en src/app/layout.tsx) o, si no hay, una pantalla en blanco. Es el mismo azul
 * con la cancha y el isotipo de components/arranque.tsx, en el mismo lugar, para
 * que al cargar la app el dibujo no salte. Sin texto: acá no está la tipografía.
 */
function arranque({ ancho, alto, escala }) {
  const lado = 90;
  // El isotipo de arranque.tsx queda un poco arriba del centro, por el lema y las pelotas de abajo.
  const x = (ancho - lado) / 2;
  const y = alto / 2 - 112 - lado / 2;
  const cancha = (alto * 1.25) / 400;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho * escala}" height="${alto * escala}" viewBox="0 0 ${ancho} ${alto}">
    <rect width="${ancho}" height="${alto}" fill="${AZUL}"/>
    <g transform="translate(${ancho / 2} ${alto / 2}) rotate(12) scale(${cancha}) translate(-100 -200)" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="3">
      <rect x="6" y="6" width="188" height="388" rx="3"/>
      <path d="M6 200h188" stroke-width="5"/>
      <path d="M6 70h188M6 330h188M100 70v260"/>
    </g>
    <g transform="translate(${x} ${y}) scale(${lado / 48})">
      <rect width="48" height="48" rx="12" fill="${AZUL}" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
      <g fill="none" stroke="#fff" stroke-width="2.5">
        <rect x="9" y="7" width="30" height="34" rx="2"/>
        <path d="M9 24h30M24 7v8M24 33v8"/>
      </g>
      <circle cx="18" cy="29.5" r="3.2" fill="${PELOTA}"/>
      <circle cx="30" cy="29.5" r="3.2" fill="${PELOTA}"/>
    </g>
  </svg>`;
}

const pantallas = JSON.parse(await readFile("src/lib/pantallas-ios.json", "utf8"));
await mkdir("public/arranque", { recursive: true });
for (const pantalla of pantallas) {
  const { ancho, alto, escala } = pantalla;
  await sharp(Buffer.from(arranque(pantalla)))
    .png({ palette: true, colours: 64 })
    .toFile(`public/arranque/iphone-${ancho}x${alto}@${escala}.png`);
}
console.log(`Íconos y ${pantallas.length} pantallas de arranque generados.`);
