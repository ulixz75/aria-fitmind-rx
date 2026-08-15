# RepDB Preview — README

Gracias por probar RepDB. Este pack es un **subconjunto gratuito de muestra** distribuido bajo la licencia **CC BY-NC 4.0** — pensado para
prototipado y evaluación. Construye algo, comprueba si la forma de los datos
encaja con tu proyecto, y luego pasa a un plan de pago para uso comercial y
acceso al dataset completo.

## Contenido

```
preview.json       — una muestra de ejercicios (esquema v3), completo EN + DE + ES
preview.en.json    — vista monolingüe ligera (`name`/`description`/...)
preview.de.json    — lo mismo, alemán
preview.es.json    — lo mismo, español
exercise-list.json — manifiesto de cobertura: slug + nombre (EN/DE/ES) + categoría de TODOS los ejercicios del dataset de pago completo (no solo esta vista previa)
images/
  flat/            — WebP estilo flat, 1024×1024, fondo sólido diseñado (tier Starter + Standard)
  classic-white/   — WebP estilo classic, 1024×1024, fondo blanco (muestra del tier Starter)
  classic/         — WebP estilo classic, resolución nativa del tier Standard (1024 px+), fondo transparente
  animations/      — algunas animaciones de ejercicios en bucle (WebP transparente, muestra del tier Standard)
  muscles/         — diagramas anatómicos de músculos en WebP
  equipment/       — iconos de equipamiento en WebP
index.html          — visor autocontenido del bundle — ábrelo directamente,
                      sin servidor ni conexión a internet
README.md          — versión en inglés
README.de.md       — alemán
README.es.md       — este archivo (español)
LICENSE.md         — CC BY-NC 4.0 (inglés)
LICENSE.de.md      — alemán
LICENSE.es.md      — español
```

## Inicio rápido

¿Solo quieres echar un vistazo? Abre **`index.html`** — un visor autocontenido
con todos los ejercicios, estilos de imagen y animaciones, sin necesidad de
servidor. Funciona directamente desde el sistema de archivos (doble clic).

Los ejemplos de JSON de abajo usan `fetch()`, que los navegadores bloquean en
archivos locales (`file://`) por seguridad — sirve la carpeta por HTTP primero,
p. ej. con `npx serve .` o `python -m http.server`.

### JSON — multilingüe completo

```js
const data = await fetch("./preview.json").then(r => r.json());
console.log(data.exercises.length); // ejercicios en este preview
console.log(data.exercises[0].name_en, data.exercises[0].name_es);
```

### JSON — un solo idioma (más pequeño, más simple)

```js
const data = await fetch("./preview.es.json").then(r => r.json());
console.log(data.exercises[0].name);              // "Sentadilla" — campo directo
console.log(data.enum_labels.category[data.exercises[0].category]); // "Fuerza"
```

`enum_labels` cubre `category`, `force_type`, `mechanic`, `difficulty`,
`body_part` y `goals`, así puedes mostrar campos basados en slug sin tener
que mantener tu propia tabla de traducciones.

### Imágenes

Las imágenes estáticas de ejercicios se incluyen con la misma resolución que
en los bundles de pago: flat y classic-white son de 1024×1024; classic
transparente usa su resolución nativa del tier Standard (1024 px o más). Los
diagramas musculares y los iconos de equipamiento tienen sus propios tamaños
nativos — ver los ejemplos de JSON abajo. Tres estilos de imagen por ejercicio,
que corresponden a los tiers de pago:

```
images/flat/bench-dips-start.webp          — ilustración plana, fondo sólido (Starter + Standard)
images/flat/bench-dips-peak.webp
images/classic-white/bench-dips-start.webp — estilo render 3D, fondo blanco (Starter)
images/classic-white/bench-dips-peak.webp
images/classic/bench-dips-start.webp       — estilo render 3D, fondo transparente (Standard)
images/classic/bench-dips-peak.webp
```

Dos variantes por ejercicio: `start` y `peak` (posición inicial y pico del
movimiento).

Músculos y equipamiento se referencian por su campo `image` en el JSON:

```js
const muscle = data.muscles["biceps_brachii"];
const imgPath = `images/muscles/${muscle.image}`;  // → images/muscles/biceps-brachii.webp

const equip = data.equipment["barbell"];
const imgPath = `images/equipment/${equip.image}`;  // → images/equipment/barbell.webp
```

## Lo que NO incluye el preview

El preview es deliberadamente un subconjunto. El bundle de pago añade:

- **Dataset completo** — el catálogo completo de ejercicios (este preview es una pequeña muestra curada).
- **Soporte de migración por email** — los planes Standard y Enterprise
  incluyen mapeo manual para los slugs que no logramos auto-emparejar.
- **Licencia comercial** — necesaria si lo lanzas en un producto que genera
  dinero.

Planes y precios actuales en https://repdb.co/pricing.

## Esquema de un vistazo

Nivel superior del JSON (`preview.json` completo):
- `schema_version` — entero, actualmente `3`.
- `generated_at` — marca de tiempo de build en ISO8601 UTC.
- `locales` — `["de", "en", "es"]`.
- `source` — `"repdb-preview"` (te ayuda a detectar si por accidente envías
  el preview a producción — en el bundle de pago este campo no existe).
- `exercises[]` — ver más abajo.
- `muscles` — tabla de lookup con traducciones; cada entrada tiene un campo
  `image`. Sirve desde `images/muscles/`.
- `equipment` — misma forma, desde `images/equipment/`.
- `relation_targets` — un lookup de nombres (`id → name_{en,de,es}`) para los
  targets de `relations[]` que no están ellos mismos en `exercises[]` de este
  preview. Este preview es una muestra de 21 ejercicios de un catálogo de
  ~600, así que la mayoría de los targets de relación quedan fuera;
  `index.html` lo usa para mostrar un nombre real en vez de un slug pelado.
  Solo presente si existe al menos un target de ese tipo.

Los archivos monolingües ligeros (`preview.{en,de,es}.json`) sustituyen los
campos con sufijo `_en/_de/_es` por `name`/`description`/`instructions`/
`tips` directos para el idioma elegido, y añaden un mapa `enum_labels` en
el nivel superior. `relation_targets` (si existe) se aplana del mismo modo —
`id → name` en vez de `id → {name_en, name_de, name_es}`.

Por ejercicio (bundle completo):
- `id` (slug), `name_{en,de,es}`, `description_{en,de,es}` (cuando existe)
- `instructions_{en,de,es}` (array de strings)
- `tips_{en,de,es}` (array de strings, cuando existe)
- `category`, `force_type`, `mechanic`, `difficulty`
- `equipment`, `body_part`, `primary_muscles[]`, `secondary_muscles[]`
- `goals[]`, `tags[]`, `variation_group`
- `is_unilateral`, `is_bodyweight`, `is_placeholder`
- `images` — `{classic: ["start","peak"], flat: ["start","peak"]}`
  (etiquetas de variante, NO nombres de archivo). Construye el nombre como
  `{id}-{variant}.webp` y búscalo en `images/{style}/`.
- `animation` — booleano, `true` cuando existe un WebP en bucle en
  `images/animations/{id}.webp` (solo estilo classic).
- `animation_type` — `"motion"` (clip de movimiento completo) o `"two_pose"`
  (una transición start/peak más simple — el valor por defecto anterior).
  

## Licencia

CC BY-NC 4.0 — ver `LICENSE.es.md`. **Solo uso no comercial.** Para cualquier
uso que genere ingresos (app de pago, función de pago, producto financiado
por publicidad, trabajo para clientes), actualiza en
https://repdb.co/pricing.

## Soporte

¿Preguntas? support@repdb.co
