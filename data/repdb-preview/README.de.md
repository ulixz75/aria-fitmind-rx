# RepDB Preview — README

Danke, dass du RepDB ausprobierst. Dieses Paket ist ein **kostenloses Beispiel-Subset** unter der **CC BY-NC 4.0** Lizenz — gedacht für Prototyping
und Evaluation. Bau etwas damit, schau wie die Datenstruktur zu deinem Projekt
passt, und upgrade dann auf einen kostenpflichtigen Tarif für kommerzielle
Nutzung und den vollständigen Datensatz.

## Inhalt

```
preview.json       — eine Auswahl an Übungen (Schema v3), vollständig EN + DE + ES
preview.en.json    — Einsprachige schlanke Variante (`name`/`description`/...)
preview.de.json    — dasselbe, Deutsch
preview.es.json    — dasselbe, Spanisch
exercise-list.json — Abdeckungs-Manifest: Slug + Name (EN/DE/ES) + Kategorie für ALLE Übungen des vollen kostenpflichtigen Datensatzes (nicht nur diese Vorschau)
images/
  flat/            — Flat-Style WebP, 1024×1024, gestalteter einfarbiger Hintergrund (Starter- + Standard-Tier)
  classic-white/   — Classic-Style WebP, 1024×1024, weißer Hintergrund (Kostprobe des Starter-Tiers)
  classic/         — Classic-Style WebP, native Standard-Tier-Auflösung (1024 px+), transparenter Hintergrund
  animations/      — einige loopende Übungsanimationen als transparentes WebP (Kostprobe des Standard-Tiers)
  muscles/         — anatomische Muskeldiagramm-WebPs
  equipment/       — Equipment-Icons als WebP
index.html          — eigenständiger Bundle-Viewer — direkt öffnen, kein
                      Server und keine Internetverbindung nötig
README.md          — englische Version
README.de.md       — diese Datei (Deutsch)
README.es.md       — Spanisch
LICENSE.md         — CC BY-NC 4.0 (Englisch)
LICENSE.de.md      — Deutsch
LICENSE.es.md      — Spanisch
```

## Schnellstart

Willst du dir nur einen Überblick verschaffen? Öffne **`index.html`** — ein
eigenständiger Viewer mit jeder Übung, jedem Bildstil und jeder Animation,
ohne Server. Funktioniert direkt vom Dateisystem (Doppelklick genügt).

Die JSON-Beispiele unten nutzen `fetch()`, was Browser bei lokalen Dateien
(`file://`) aus Sicherheitsgründen blockieren — liefere den Ordner zuerst
über HTTP aus, z. B. mit `npx serve .` oder `python -m http.server`.

### JSON — vollständig mehrsprachig

```js
const data = await fetch("./preview.json").then(r => r.json());
console.log(data.exercises.length); // Übungen in diesem Preview
console.log(data.exercises[0].name_en, data.exercises[0].name_de);
```

### JSON — einzelne Sprache (kleiner, einfacher)

```js
const data = await fetch("./preview.de.json").then(r => r.json());
console.log(data.exercises[0].name);              // "Kniebeuge" — direktes Feld
console.log(data.enum_labels.category[data.exercises[0].category]); // "Kraft"
```

`enum_labels` deckt `category`, `force_type`, `mechanic`, `difficulty`,
`body_part` und `goals` ab — damit kannst du slug-basierte Felder anzeigen,
ohne eine eigene Übersetzungstabelle zu pflegen.

### Bilder

Die Übungs-Standbilder werden in derselben Auflösung wie in den
kostenpflichtigen Bundles geliefert: Flat und Classic-White sind 1024×1024;
transparentes Classic nutzt seine native Standard-Tier-Auflösung (1024 px oder
größer). Muskeldiagramme und Equipment-Icons haben ihre eigenen nativen Größen
— siehe die JSON-Beispiele unten. Drei Bildstile pro Übung, passend zu den
kostenpflichtigen Tarifen:

```
images/flat/bench-dips-start.webp          — flache Illustration, einfarbiger Hintergrund (Starter + Standard)
images/flat/bench-dips-peak.webp
images/classic-white/bench-dips-start.webp — 3D-Render-Stil, weißer Hintergrund (Starter)
images/classic-white/bench-dips-peak.webp
images/classic/bench-dips-start.webp       — 3D-Render-Stil, transparenter Hintergrund (Standard)
images/classic/bench-dips-peak.webp
```

Zwei Varianten pro Übung: `start` und `peak` (Startposition und Höhepunkt der
Bewegung).

Muskeln und Equipment werden über das `image`-Feld im JSON referenziert:

```js
const muscle = data.muscles["biceps_brachii"];
const imgPath = `images/muscles/${muscle.image}`;  // → images/muscles/biceps-brachii.webp

const equip = data.equipment["barbell"];
const imgPath = `images/equipment/${equip.image}`;  // → images/equipment/barbell.webp
```

## Was NICHT im Preview enthalten ist

Das Preview ist bewusst ein Ausschnitt. Im kostenpflichtigen Bundle bekommst
du zusätzlich:

- **Vollständiger Datensatz** — der komplette Übungskatalog (dieses Preview ist eine kleine, kuratierte Auswahl).
- **Migrations-Support per E-Mail** — Standard- und Enterprise-Tarife
  enthalten manuelles Mapping für Slugs, die wir nicht automatisch zuordnen
  konnten.
- **Kommerzielle Lizenz** — erforderlich, sobald du das in einem Produkt
  einsetzt, das Geld verdient.

Aktuelle Tarife und Preise unter https://repdb.co/pricing.

## Schema-Überblick

JSON-Top-Level (vollständige `preview.json`):
- `schema_version` — Ganzzahl, aktuell `3`.
- `generated_at` — ISO8601-UTC-Build-Zeitstempel.
- `locales` — `["de", "en", "es"]`.
- `source` — `"repdb-preview"` (hilft dir zu erkennen, wenn du das
  Preview-Pack versehentlich in die Produktion lädst — im bezahlten Bundle
  fehlt dieses Feld).
- `exercises[]` — siehe unten.
- `muscles` — Lookup-Tabelle mit Übersetzungen; jeder Eintrag hat ein
  `image`-Feld. Aus `images/muscles/` ausliefern.
- `equipment` — gleiche Form, aus `images/equipment/`.
- `relation_targets` — Namens-Lookup (`id → name_{en,de,es}`) für
  `relations[]`-Ziele, die nicht selbst in den `exercises[]` dieses Previews
  enthalten sind. Dieses Preview ist eine 21-Übungen-Stichprobe aus einem
  Katalog mit ~600 Übungen, daher liegen die meisten Relation-Ziele außerhalb;
  `index.html` nutzt dieses Feld, um statt eines bloßen Slugs einen echten
  Namen anzuzeigen. Nur vorhanden, wenn mindestens ein solches Ziel existiert.

Die einsprachigen schlanken Dateien (`preview.{en,de,es}.json`) ersetzen die
mit `_en/_de/_es` suffigierten Felder durch direkte
`name`/`description`/`instructions`/`tips` für die gewählte Sprache und
ergänzen oben ein `enum_labels`-Mapping. `relation_targets` (falls vorhanden)
wird genauso abgeflacht — `id → name` statt `id → {name_en, name_de, name_es}`.

Pro Übung (vollständiges Bundle):
- `id` (Slug), `name_{en,de,es}`, `description_{en,de,es}` (sofern vorhanden)
- `instructions_{en,de,es}` (Array von Strings)
- `tips_{en,de,es}` (Array von Strings, sofern vorhanden)
- `category`, `force_type`, `mechanic`, `difficulty`
- `equipment`, `body_part`, `primary_muscles[]`, `secondary_muscles[]`
- `goals[]`, `tags[]`, `variation_group`
- `is_unilateral`, `is_bodyweight`, `is_placeholder`
- `images` — `{classic: ["start","peak"], flat: ["start","peak"]}`
  (Varianten-Bezeichnungen, KEINE Dateinamen). Den Dateinamen baust du als
  `{id}-{variant}.webp` und schaust in `images/{style}/` nach.
- `animation` — bool, `true` wenn unter `images/animations/{id}.webp` eine
  Loop-WebP existiert (nur Classic-Stil).
- `animation_type` — `"motion"` (vollständiger Motion-Clip) oder `"two_pose"`
  (eine einfachere Start/Peak-Überblendung — der Vorgänger-Standard).
  

## Lizenz

CC BY-NC 4.0 — siehe `LICENSE.de.md`. **Nur nicht-kommerzielle Nutzung.** Für
jede Form von einnahmenrelevanter Nutzung (kostenpflichtige App, bezahltes
Feature, werbefinanziertes Produkt, Auftragsarbeit) brauchst du ein Upgrade
unter https://repdb.co/pricing.

## Support

Fragen? support@repdb.co
