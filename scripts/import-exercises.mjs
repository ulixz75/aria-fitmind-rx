import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SERVICE_ACCOUNT_PATH = path.join(
  ROOT,
  "secrets",
  "firebase-admin.json"
);

const DATASET_PATH = path.join(
  ROOT,
  "data",
  "repdb-preview"
);

const JSON_PATH = path.join(
  DATASET_PATH,
  "preview.en.json"
);

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  throw new Error(
    `Firebase service account not found:\n${SERVICE_ACCOUNT_PATH}`
  );
}

if (!fs.existsSync(JSON_PATH)) {
  throw new Error(
    `RepDB dataset not found:\n${JSON_PATH}`
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
);

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "fitmind-rx-portal-app-2026.firebasestorage.app",
});

const db = getFirestore();
const bucket = getStorage().bucket();

const dataset = JSON.parse(
  fs.readFileSync(JSON_PATH, "utf8")
);

const exercises = dataset.exercises ?? [];

const args = process.argv.slice(2);

const limitArg = args.find((arg) =>
  arg.startsWith("--limit=")
);

const limit = limitArg
  ? Number(limitArg.split("=")[1])
  : null;

const selectedExercises = limit
  ? exercises.slice(0, limit)
  : exercises;

function findExistingImage(exerciseId, variants) {
  for (const variant of variants) {
    const filePath = path.join(
      DATASET_PATH,
      "images",
      variant.folder,
      `${exerciseId}-${variant.suffix}.webp`
    );

    if (fs.existsSync(filePath)) {
      return {
        filePath,
        folder: variant.folder,
        suffix: variant.suffix,
      };
    }
  }

  return null;
}

async function uploadImage(
  exerciseId,
  image,
  type
) {
  const destination =
    `exercises/${exerciseId}/${type}.webp`;

  await bucket.upload(image.filePath, {
    destination,
    metadata: {
      contentType: "image/webp",
      metadata: {
        exerciseId,
        source: "repdb-preview",
        mediaType: type,
      },
    },
  });

  return `gs://${bucket.name}/${destination}`;
}

console.log("");
console.log("======================================");
console.log(" ARIA Exercise Importer");
console.log("======================================");
console.log(`Source: RepDB Preview`);
console.log(`Available exercises: ${exercises.length}`);
console.log(
  `Importing: ${selectedExercises.length}`
);
console.log("");

for (let i = 0; i < selectedExercises.length; i++) {
  const exercise = selectedExercises[i];

  console.log(
    `[${i + 1}/${selectedExercises.length}] ${exercise.name}`
  );

  const exerciseId = exercise.id;

  const media = {
    classic: null,
    flat: null,
    animation: null,
  };

  /*
   * CLASSIC
   *
   * Most exercises use:
   * exercise-start.webp
   * exercise-peak.webp
   *
   * Battle Ropes is an exception and uses:
   * battle-ropes-main.webp
   */

  const classicStart = findExistingImage(
    exerciseId,
    [
      {
        folder: "classic",
        suffix: "start",
      },
      {
        folder: "classic",
        suffix: "main",
      },
    ]
  );

  const classicPeak = findExistingImage(
    exerciseId,
    [
      {
        folder: "classic",
        suffix: "peak",
      },
    ]
  );

  if (classicStart) {
    media.classic = {
      start: await uploadImage(
        exerciseId,
        classicStart,
        "classic-start"
      ),
    };

    if (classicPeak) {
      media.classic.peak = await uploadImage(
        exerciseId,
        classicPeak,
        "classic-peak"
      );
    }
  }

  /*
   * FLAT
   */

  const flatStart = findExistingImage(
    exerciseId,
    [
      {
        folder: "flat",
        suffix: "start",
      },
      {
        folder: "flat",
        suffix: "main",
      },
    ]
  );

  const flatPeak = findExistingImage(
    exerciseId,
    [
      {
        folder: "flat",
        suffix: "peak",
      },
    ]
  );

  if (flatStart) {
    media.flat = {
      start: await uploadImage(
        exerciseId,
        flatStart,
        "flat-start"
      ),
    };

    if (flatPeak) {
      media.flat.peak = await uploadImage(
        exerciseId,
        flatPeak,
        "flat-peak"
      );
    }
  }

  /*
   * ANIMATION
   *
   * RepDB provides:
   * images/animations/exercise.webp
   */

  const animationPath = path.join(
    DATASET_PATH,
    "images",
    "animations",
    `${exerciseId}.webp`
  );

  if (fs.existsSync(animationPath)) {
    media.animation = await uploadImage(
      exerciseId,
      {
        filePath: animationPath,
      },
      "animation"
    );
  }

  /*
   * FIRESTORE DOCUMENT
   */

  const exerciseData = {
    name: exercise.name ?? "",
    slug: exercise.id ?? "",

    description: exercise.description ?? "",

    category: exercise.category ?? "",
    bodyPart: exercise.body_part ?? "",
    forceType: exercise.force_type ?? "",
    mechanic: exercise.mechanic ?? "",
    difficulty: exercise.difficulty ?? "",

    primaryMuscles: exercise.primary_muscles ?? [],
    secondaryMuscles: exercise.secondary_muscles ?? [],

    equipment: exercise.equipment
      ? [exercise.equipment]
      : [],

    instructions: exercise.instructions ?? [],
    tips: exercise.tips ?? [],

    goals: exercise.goals ?? [],
    tags: exercise.tags ?? [],
    synonyms: exercise.synonyms ?? [],

    isUnilateral: exercise.is_unilateral ?? false,
    isBodyweight: exercise.is_bodyweight ?? false,

    animation: exercise.animation ?? false,
    animationType: exercise.animation_type ?? "",

    met:
      typeof exercise.met === "number"
        ? exercise.met
        : null,

    media,

    active: true,

    source: "repdb-preview",

    updatedAt: new Date(),
  };

  await db
    .collection("exercises")
    .doc(exerciseId)
    .set(exerciseData, {
      merge: true,
    });

  console.log("  ✓ Firestore");

  if (media.classic) {
    console.log("  ✓ Classic media");
  }

  if (media.flat) {
    console.log("  ✓ Flat media");
  }

  if (media.animation) {
    console.log("  ✓ Animation");
  }

  console.log("");
}

console.log("======================================");
console.log(" Import completed");
console.log(
  `${selectedExercises.length} exercise(s) processed.`
);
console.log("======================================");
console.log("");