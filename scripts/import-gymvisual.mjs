import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

/* ============================================================
   PATHS
   ============================================================ */

const SERVICE_ACCOUNT_PATH = path.join(
  ROOT,
  "secrets",
  "firebase-admin.json"
);

const DATASET_ROOT = path.join(
  "/home/ulixzgarcia",
  "exercises-dataset-main",
  "exercises-dataset-main"
);

const JSON_PATH = path.join(
  DATASET_ROOT,
  "data",
  "exercises.json"
);

const IMAGES_DIR = path.join(DATASET_ROOT, "images");
const VIDEOS_DIR = path.join(DATASET_ROOT, "videos");

/* ============================================================
   GUARD CHECKS
   ============================================================ */

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  throw new Error(
    `Firebase service account not found:\n${SERVICE_ACCOUNT_PATH}`
  );
}

if (!fs.existsSync(JSON_PATH)) {
  throw new Error(
    `Gymvisual exercises.json not found:\n${JSON_PATH}`
  );
}

/* ============================================================
   INIT FIREBASE
   ============================================================ */

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
);

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "fitmind-rx-portal-app-2026.firebasestorage.app",
});

const db = getFirestore();
const bucket = getStorage().bucket();

/* ============================================================
   LOAD DATASET
   ============================================================ */

const exercises = JSON.parse(
  fs.readFileSync(JSON_PATH, "utf8")
);

/* ============================================================
   CLI ARGS
   --limit=N   import only the first N exercises
   --dry-run   log what would happen, skip uploads and writes
   ============================================================ */

const args = process.argv.slice(2);

const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

const dryRun = args.includes("--dry-run");

const selected = limit ? exercises.slice(0, limit) : exercises;

/* ============================================================
   HELPERS
   ============================================================ */

async function uploadFile(localPath, destination, contentType) {
  if (dryRun) {
    console.log(`    [dry-run] would upload → ${destination}`);
    return `gs://${bucket.name}/${destination}`;
  }

  // Skip if local file doesn't exist (some IDs may have gaps)
  if (!fs.existsSync(localPath)) {
    return null;
  }

  await bucket.upload(localPath, {
    destination,
    metadata: {
      contentType,
      metadata: {
        source: "gymvisual",
      },
    },
  });

  return `gs://${bucket.name}/${destination}`;
}

/* ============================================================
   MAIN IMPORT LOOP
   ============================================================ */

console.log("");
console.log("======================================================");
console.log("  ARIA Exercise Importer — Gymvisual Dataset");
console.log("======================================================");
console.log(`Source     : ${JSON_PATH}`);
console.log(`Total      : ${exercises.length} exercises`);
console.log(`Importing  : ${selected.length}`);
console.log(`Dry run    : ${dryRun ? "YES (no writes)" : "NO"}`);
console.log("======================================================");
console.log("");

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

for (let i = 0; i < selected.length; i++) {
  const exercise = selected[i];
  const exerciseId = exercise.id; // e.g. "0001"

  process.stdout.write(
    `[${String(i + 1).padStart(4, " ")}/${selected.length}] ${exercise.name} (${exerciseId}) … `
  );

  try {
    /* ----------------------------------------------------------
       1. RESOLVE LOCAL FILE PATHS
       ---------------------------------------------------------- */

    // Image filename pattern: "0001-2gPfomN.jpg"
    // We derive it from the dataset's own `image` field
    const imageRelPath = exercise.image; // "images/0001-2gPfomN.jpg"
    const gifRelPath = exercise.gif_url;  // "videos/0001-2gPfomN.gif"

    const imageFilename = imageRelPath
      ? path.basename(imageRelPath)
      : null;
    const gifFilename = gifRelPath
      ? path.basename(gifRelPath)
      : null;

    const localImagePath = imageFilename
      ? path.join(IMAGES_DIR, imageFilename)
      : null;
    const localGifPath = gifFilename
      ? path.join(VIDEOS_DIR, gifFilename)
      : null;

    /* ----------------------------------------------------------
       2. UPLOAD TO STORAGE
       ---------------------------------------------------------- */

    const thumbnailGsPath = localImagePath
      ? await uploadFile(
          localImagePath,
          `exercises/${exerciseId}/thumbnail.jpg`,
          "image/jpeg"
        )
      : null;

    const gifGsPath = localGifPath
      ? await uploadFile(
          localGifPath,
          `exercises/${exerciseId}/animation.gif`,
          "image/gif"
        )
      : null;

    /* ----------------------------------------------------------
       3. BUILD FIRESTORE DOCUMENT
       ---------------------------------------------------------- */

    // Use English instructions from instruction_steps if available,
    // falling back to the top-level instructions field.
    const instructions =
      exercise.instruction_steps?.en ??
      exercise.instructions ??
      [];

    // Map muscle_group (string) → primaryMuscles (string[])
    const primaryMuscles = exercise.muscle_group
      ? [exercise.muscle_group]
      : [];

    // Derive isBodyweight from equipment string
    const isBodyweight =
      typeof exercise.equipment === "string" &&
      exercise.equipment.toLowerCase().includes("body weight");

    const exerciseData = {
      name: exercise.name ?? "",
      slug: exerciseId,

      // Not provided by Gymvisual — kept empty for compatibility
      description: "",
      forceType: "",
      mechanic: "",
      difficulty: "",
      tips: [],
      goals: [],
      synonyms: [],
      isUnilateral: false,
      animationType: "",
      met: null,

      // Fields populated from Gymvisual
      category: exercise.category ?? "",
      bodyPart: exercise.body_part ?? "",
      equipment: exercise.equipment
        ? [exercise.equipment]
        : [],

      primaryMuscles,
      secondaryMuscles: exercise.secondary_muscles ?? [],

      instructions,

      tags: [exercise.target, exercise.category].filter(Boolean),

      isBodyweight,

      // All Gymvisual exercises have an animated GIF
      animation: gifGsPath !== null,

      media: {
        thumbnail: thumbnailGsPath,
        gif: gifGsPath,
      },

      active: true,
      source: "gymvisual",

      updatedAt: FieldValue.serverTimestamp(),
    };

    /* ----------------------------------------------------------
       4. WRITE TO FIRESTORE
       ---------------------------------------------------------- */

    if (!dryRun) {
      await db
        .collection("exercises")
        .doc(exerciseId)
        .set(exerciseData, { merge: true });
    }

    console.log("✓");
    successCount++;
  } catch (error) {
    console.log("✗");
    console.error(`    ERROR: ${error.message}`);
    errorCount++;
  }
}

/* ============================================================
   SUMMARY
   ============================================================ */

console.log("");
console.log("======================================================");
console.log("  Import complete");
console.log(`  ✓ Success : ${successCount}`);
console.log(`  ⚠ Skipped : ${skipCount}`);
console.log(`  ✗ Errors  : ${errorCount}`);
if (dryRun) {
  console.log("  [Dry run — no data was written]");
}
console.log("======================================================");
console.log("");
