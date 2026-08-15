# RepDB Preview — README

Thanks for trying RepDB. This pack is a **free sample subset** distributed
under the **CC BY-NC 4.0** license — meant for prototyping and evaluation.
Build something, see how the data shape fits, then upgrade to a paid tier for
commercial use and the full dataset.

## Contents

```
preview.json       — a sample of exercises (schema v3), full EN + DE + ES
preview.en.json    — single-locale slim view (bare `name`/`description`/...)
preview.de.json    — same, German
preview.es.json    — same, Spanish
exercise-list.json — coverage manifest: slug + name (EN/DE/ES) + category for ALL exercises in the full paid dataset (not just this preview)
images/
  flat/            — flat-style WebP, 1024×1024, designed solid background (Starter + Standard tier)
  classic-white/   — classic-style WebP, 1024×1024, white background (sample of the Starter tier)
  classic/         — classic-style WebP, native Standard-tier resolution (1024px+), transparent background
  animations/      — a few looping transparent-WebP exercise animations (sample of the Standard tier)
  muscles/         — anatomical muscle diagram WebP
  equipment/       — equipment icon WebP
index.html          — self-contained bundle viewer — open directly, no server
                      or internet connection needed
README.md          — this file (English)
README.de.md       — German
README.es.md       — Spanish
LICENSE.md         — CC BY-NC 4.0 (English)
LICENSE.de.md      — German
LICENSE.es.md      — Spanish
```

## Quickstart

Just want to look around? Open **`index.html`** — a self-contained viewer
with every exercise, image style, and animation, no server needed. It works
straight off the filesystem (double-click it).

The JSON snippets below use `fetch()`, which browsers block on local files
(`file://`) for security — serve the folder over HTTP first, e.g. `npx serve .`
or `python -m http.server`.

### JSON — full multilingual

```js
const data = await fetch("./preview.json").then(r => r.json());
console.log(data.exercises.length); // exercises in this preview
console.log(data.exercises[0].name_en, data.exercises[0].name_de);
```

### JSON — single locale (smaller, simpler)

```js
const data = await fetch("./preview.de.json").then(r => r.json());
console.log(data.exercises[0].name);              // "Kniebeuge" — bare field
console.log(data.enum_labels.category[data.exercises[0].category]); // "Kraft"
```

`enum_labels` covers `category`, `force_type`, `mechanic`, `difficulty`,
`body_part`, and `goals` so you can render slug-valued fields without a
hand-written translation table.

### Images

Exercise stills ship at the same resolution as the paid bundles: flat and
classic-white are 1024×1024; transparent classic uses its native Standard-tier
resolution (1024px or larger). Muscle diagrams and equipment icons ship at
their own native sizes — see the JSON snippets below. Three exercise-image
styles, matching the paid tiers:

```
images/flat/bench-dips-start.webp          — flat illustration, solid background (Starter + Standard)
images/flat/bench-dips-peak.webp
images/classic-white/bench-dips-start.webp — 3D-render style, white background (Starter)
images/classic-white/bench-dips-peak.webp
images/classic/bench-dips-start.webp       — 3D-render style, transparent background (Standard)
images/classic/bench-dips-peak.webp
```

Two variants per exercise: `start` and `peak` (start position and peak of the
movement).

Muscles and equipment are referenced by their `image` field in the JSON:

```js
const muscle = data.muscles["biceps_brachii"];
const imgPath = `images/muscles/${muscle.image}`;  // → images/muscles/biceps-brachii.webp

const equip = data.equipment["barbell"];
const imgPath = `images/equipment/${equip.image}`;  // → images/equipment/barbell.webp
```

## What's NOT in the preview

The preview is a deliberate subset. The paid bundle adds:

- **Full dataset** — the complete exercise catalog (this preview is a small curated sample).
- **Migration support email** — Standard and Enterprise tiers include
  hand-mapping for slugs we couldn't auto-match.
- **Commercial license** — required if you ship in a product that earns money.

See https://repdb.co/pricing for current tiers and pricing.

## Schema at a glance

Top-level JSON (full `preview.json`):
- `schema_version` — integer, currently `3`.
- `generated_at` — ISO8601 UTC build timestamp.
- `locales` — `["de", "en", "es"]`.
- `source` — `"repdb-preview"` (helps you spot if you accidentally ship the
  preview pack in production — replace with the paid bundle, where this field
  is absent).
- `exercises[]` — see below.
- `muscles` — lookup table with translations; each entry has an `image`
  filename. Serve from `images/muscles/`.
- `equipment` — same shape, served from `images/equipment/`.
- `relation_targets` — a name lookup (`id → name_{en,de,es}`) for `relations[]`
  targets that aren't themselves in this preview's `exercises[]`. This preview
  is a 21-exercise sample of a ~600-exercise catalog, so most relation targets
  fall outside it; `index.html` uses this to show a real name instead of a
  bare slug. Present only when at least one such target exists.

Per-locale slim JSON (`preview.{en,de,es}.json`) replaces `_en/_de/_es` suffixed
fields with bare `name`/`description`/`instructions`/`tips` for the chosen
locale, and adds an `enum_labels` map at the top level. `relation_targets`
(when present) is flattened the same way — `id → name` instead of
`id → {name_en, name_de, name_es}`.

Per exercise (full bundle):
- `id` (slug), `name_{en,de,es}`, `description_{en,de,es}` (where available)
- `instructions_{en,de,es}` (array of strings)
- `tips_{en,de,es}` (array of strings, where available)
- `category`, `force_type`, `mechanic`, `difficulty`
- `equipment`, `body_part`, `primary_muscles[]`, `secondary_muscles[]`
- `goals[]`, `tags[]`, `variation_group`
- `is_unilateral`, `is_bodyweight`, `is_placeholder`
- `images` — `{classic: ["start","peak"], flat: ["start","peak"]}` (variant
  labels, NOT filenames). Construct the filename as `{id}-{variant}.webp` and
  look in `images/{style}/`.
- `animation` — bool, true when a looping WebP exists at
  `images/animations/{id}.webp` (classic style only).
- `animation_type` — `"motion"` (full motion clip) or `"two_pose"` (a
  simpler start/peak crossfade — the pre-motion default). 

## License

CC BY-NC 4.0 — see `LICENSE.md`. **Non-commercial only.** For any
revenue-generating use (paid app, paid feature, advertising-supported product,
client work), upgrade at https://repdb.co/pricing.

## Support

Questions? support@repdb.co
