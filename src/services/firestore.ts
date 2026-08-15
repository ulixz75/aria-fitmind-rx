import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  getDownloadURL,
  ref,
} from "firebase/storage";

import { db, storage } from "./firebase";

import type {
  AccountStatus,
  ClientProfile,
  UserDoc,
} from "../types/models";

import type { Exercise } from "../types/exercises";

import type {
  ProgramDay,
  TrainingProgram,
} from "../types/programs";

/* ============================================================
   USERS / CLIENT PROFILES
   ============================================================ */

export async function getUserDoc(uid: string) {
  const snapshot = await getDoc(
    doc(db, "users", uid),
  );

  return snapshot.exists()
    ? (snapshot.data() as UserDoc)
    : null;
}

export async function upsertClientProfile(
  profile: ClientProfile,
) {
  const cleanProfile = Object.fromEntries(
    Object.entries(profile).filter(
      ([, value]) => value !== undefined,
    ),
  );

  await setDoc(
    doc(db, "clientProfiles", profile.uid),
    {
      ...cleanProfile,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}

export async function listUsers(
  status?: AccountStatus,
) {
  const usersCollection = collection(
    db,
    "users",
  );

  const q = status
    ? query(
        usersCollection,
        where("status", "==", status),
        orderBy("createdAt", "desc"),
        limit(100),
      )
    : query(
        usersCollection,
        orderBy("createdAt", "desc"),
        limit(100),
      );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    (document) =>
      document.data() as UserDoc,
  );
}

export async function updateAccountStatus(
  uid: string,
  status: AccountStatus,
) {
  await updateDoc(
    doc(db, "users", uid),
    {
      status,
      updatedAt: serverTimestamp(),
    },
  );
}

export async function deleteUserDoc(
  uid: string,
) {
  await deleteDoc(
    doc(db, "users", uid),
  );
}

export async function getClientProfile(
  uid: string,
): Promise<ClientProfile | null> {
  const snapshot = await getDoc(
    doc(db, "clientProfiles", uid),
  );

  return snapshot.exists()
    ? (snapshot.data() as ClientProfile)
    : null;
}

/* ============================================================
   EXERCISES
   ============================================================ */

export async function listExercises(): Promise<
  Exercise[]
> {
  const snapshot = await getDocs(
    query(
      collection(db, "exercises"),
      orderBy("name", "asc"),
    ),
  );

  return snapshot.docs.map(
    (document) => ({
      id: document.id,
      ...(document.data() as Omit<
        Exercise,
        "id"
      >),
    }),
  );
}

export async function getExercise(
  exerciseId: string,
): Promise<Exercise | null> {
  const snapshot = await getDoc(
    doc(db, "exercises", exerciseId),
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<
      Exercise,
      "id"
    >),
  };
}

/* ============================================================
   FIREBASE STORAGE
   ============================================================ */

export async function resolveStorageUrl(
  storagePath:
    | string
    | null
    | undefined,
): Promise<string | null> {
  if (!storagePath) {
    return null;
  }

  try {
    let path = storagePath;

    /*
     * Convert:
     * gs://bucket/path/file.webp
     *
     * into:
     * path/file.webp
     */

    if (path.startsWith("gs://")) {
      const firstSlash = path.indexOf(
        "/",
        5,
      );

      if (firstSlash === -1) {
        return null;
      }

      path = path.substring(
        firstSlash + 1,
      );
    }

    return await getDownloadURL(
      ref(storage, path),
    );
  } catch (error) {
    console.error(
      "Unable to resolve Storage URL:",
      storagePath,
      error,
    );

    return null;
  }
}

/* ============================================================
   TRAINING PROGRAMS
   ============================================================ */

export async function listTrainingPrograms(): Promise<
  TrainingProgram[]
> {
  const snapshot = await getDocs(
    query(
      collection(
        db,
        "trainingPrograms",
      ),
      orderBy("name", "asc"),
    ),
  );

  return snapshot.docs.map(
    (document) => ({
      id: document.id,
      ...(document.data() as Omit<
        TrainingProgram,
        "id"
      >),
    }),
  );
}

export async function createTrainingProgram(
  program: Omit<
    TrainingProgram,
    "id" | "createdAt" | "updatedAt"
  >,
): Promise<string> {
  const programRef = doc(
    collection(
      db,
      "trainingPrograms",
    ),
  );

  await setDoc(
    programRef,
    {
      ...program,
      createdAt:
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    },
  );

  return programRef.id;
}

export async function updateTrainingProgram(
  programId: string,
  program: Partial<
    Omit<
      TrainingProgram,
      "id" | "createdAt" | "updatedAt"
    >
  >,
): Promise<void> {
  const cleanProgram =
    Object.fromEntries(
      Object.entries(program).filter(
        ([, value]) =>
          value !== undefined,
      ),
    );

  await updateDoc(
    doc(
      db,
      "trainingPrograms",
      programId,
    ),
    {
      ...cleanProgram,
      updatedAt:
        serverTimestamp(),
    },
  );
}

/* ============================================================
   PROGRAM DAYS
   ============================================================ */

export async function listProgramDays(
  programId: string,
): Promise<ProgramDay[]> {
  const snapshot = await getDocs(
    query(
      collection(
        db,
        "programDays",
      ),
      where(
        "programId",
        "==",
        programId,
      ),
      orderBy("week", "asc"),
      orderBy(
        "dayNumber",
        "asc",
      ),
    ),
  );

  return snapshot.docs.map(
    (document) => ({
      id: document.id,
      ...(document.data() as Omit<
        ProgramDay,
        "id"
      >),
    }),
  );
}

export async function createProgramDay(
  day: Omit<
    ProgramDay,
    "id" | "createdAt" | "updatedAt"
  >,
): Promise<string> {
  const dayRef = doc(
    collection(
      db,
      "programDays",
    ),
  );

  await setDoc(
    dayRef,
    {
      ...day,
      createdAt:
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    },
  );

  return dayRef.id;
}

/* ============================================================
   REPLACE ALL PROGRAM DAYS
   ------------------------------------------------------------
   Used when editing a program.
   Deletes the previous days and writes the new version.
   ============================================================ */

export async function replaceProgramDays(
  programId: string,
  days: Omit<
    ProgramDay,
    "id" | "createdAt" | "updatedAt"
  >[],
): Promise<void> {
  const existingSnapshot =
    await getDocs(
      query(
        collection(
          db,
          "programDays",
        ),
        where(
          "programId",
          "==",
          programId,
        ),
      ),
    );

  const batch =
    writeBatch(db);

  /*
   * Remove existing days.
   */

  for (
    const document of
      existingSnapshot.docs
  ) {
    batch.delete(
      document.ref,
    );
  }

  /*
   * Add current days.
   */

  for (const day of days) {
    const dayRef = doc(
      collection(
        db,
        "programDays",
      ),
    );

    batch.set(
      dayRef,
      {
        ...day,
        createdAt:
          serverTimestamp(),
        updatedAt:
          serverTimestamp(),
      },
    );
  }

  await batch.commit();
}

/* ============================================================
   DELETE TRAINING PROGRAM
   ------------------------------------------------------------
   Deletes the program and all associated days.
   ============================================================ */

export async function deleteTrainingProgram(
  programId: string,
): Promise<void> {
  const existingDaysSnapshot =
    await getDocs(
      query(
        collection(
          db,
          "programDays",
        ),
        where(
          "programId",
          "==",
          programId,
        ),
      ),
    );

  const batch =
    writeBatch(db);

  /*
   * Delete all program days.
   */

  for (
    const document of
      existingDaysSnapshot.docs
  ) {
    batch.delete(
      document.ref,
    );
  }

  /*
   * Delete the program itself.
   */

  batch.delete(
    doc(
      db,
      "trainingPrograms",
      programId,
    ),
  );

  await batch.commit();
}