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
  Timestamp,
} from "firebase/firestore";

import {
  getDownloadURL,
  ref,
} from "firebase/storage";

import type {
  ClientActiveProgram,
} from "../types/clientPrograms";

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
  ProgramExercise,
} from "../types/programs";

import type {
  ProgramAssignment,
} from "../types/programAssignments";

import type {
  WorkoutSession,
  WorkoutSessionStatus,
} from "../types/workout";

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

/* ============================================================
   PROGRAM ASSIGNMENTS
   ============================================================ */

export async function listClientProgramAssignments(
  clientId: string,
): Promise<ProgramAssignment[]> {
  const snapshot = await getDocs(
    query(
      collection(
        db,
        "programAssignments",
      ),
      where(
        "clientId",
        "==",
        clientId,
      ),
    ),
  );

  return snapshot.docs
    .map(
      (document) => ({
        id: document.id,
        ...(document.data() as Omit<
          ProgramAssignment,
          "id"
        >),
      }),
    )
    .sort((a, b) => {
      const aTime =
        a.createdAt &&
        typeof a.createdAt === "object" &&
        "toMillis" in a.createdAt
          ? (
              a.createdAt as {
                toMillis: () => number;
              }
            ).toMillis()
          : 0;

      const bTime =
        b.createdAt &&
        typeof b.createdAt === "object" &&
        "toMillis" in b.createdAt
          ? (
              b.createdAt as {
                toMillis: () => number;
              }
            ).toMillis()
          : 0;

      return bTime - aTime;
    });
}

export async function getActiveProgramAssignment(
  clientId: string,
): Promise<ProgramAssignment | null> {
  const assignments =
    await listClientProgramAssignments(
      clientId,
    );

  return (
    assignments.find(
      (assignment) =>
        assignment.status ===
        "active",
    ) ?? null
  );
}

export async function assignProgramToClient(
  clientId: string,
  programId: string,
  assignedBy: string,
  startDate: Date,
): Promise<string> {
  const existingAssignments =
    await listClientProgramAssignments(
      clientId,
    );

  const batch = writeBatch(db);

  /*
   * Mark the previous active assignment
   * as replaced.
   */

  for (
    const assignment of existingAssignments
  ) {
    if (assignment.status === "active") {
      batch.update(
        doc(
          db,
          "programAssignments",
          assignment.id,
        ),
        {
          status: "replaced",
          updatedAt: serverTimestamp(),
        },
      );
    }
  }

  /*
   * Create a new assignment record.
   */

  const assignmentRef = doc(
    collection(
      db,
      "programAssignments",
    ),
  );

  const startDateTimestamp =
    Timestamp.fromDate(startDate);

  batch.set(
    assignmentRef,
    {
      clientId,
      programId,
      assignedBy,
      startDate: startDateTimestamp,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  );

  /*
   * Create/update the direct current-program
   * mapping for this client.
   */

  const activeProgramRef = doc(
    db,
    "clientActivePrograms",
    clientId,
  );

  const activeProgram: ClientActiveProgram = {
    clientId,
    programId,
    assignmentId: assignmentRef.id,
    startDate: startDateTimestamp,
    status: "active",
    updatedAt: undefined,
  };

  batch.set(
    activeProgramRef,
    {
      ...activeProgram,
      updatedAt: serverTimestamp(),
    },
  );

  await batch.commit();

  return assignmentRef.id;
}

export async function getClientActiveProgram(
  clientId: string,
): Promise<ClientActiveProgram | null> {
  const snapshot = await getDoc(
    doc(
      db,
      "clientActivePrograms",
      clientId,
    ),
  );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as ClientActiveProgram;
}
/* ============================================================
   CLIENT PROGRAM
   ============================================================ */

export async function getActiveProgramForClient(
  clientId: string,
): Promise<{
  assignment: ProgramAssignment;
  program: TrainingProgram | null;
} | null> {
  const activeProgram =
    await getClientActiveProgram(
      clientId,
    );

  if (!activeProgram) {
    return null;
  }

  const assignmentSnapshot =
    await getDoc(
      doc(
        db,
        "programAssignments",
        activeProgram.assignmentId,
      ),
    );

  if (!assignmentSnapshot.exists()) {
    return null;
  }

  const assignment: ProgramAssignment = {
    id: assignmentSnapshot.id,
    ...(assignmentSnapshot.data() as Omit<
      ProgramAssignment,
      "id"
    >),
  };

  const program =
    await getTrainingProgram(
      activeProgram.programId,
    );

  return {
    assignment,
    program,
  };
}

export async function getTrainingProgram(
  programId: string,
): Promise<TrainingProgram | null> {
  const snapshot = await getDoc(
    doc(
      db,
      "trainingPrograms",
      programId,
    ),
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<
      TrainingProgram,
      "id"
    >),
  };
}

export async function getProgramDayExercises(
  day: ProgramDay,
): Promise<
  Array<{
    programExercise: ProgramExercise;
    exercise: Exercise | null;
  }>
> {
  const validExercises =
    Array.isArray(day.exercises)
      ? day.exercises.filter(
          (programExercise) =>
            programExercise &&
            typeof programExercise ===
              "object" &&
            typeof programExercise.exerciseId ===
              "string" &&
            programExercise.exerciseId.trim()
              .length > 0,
        )
      : [];

  return Promise.all(
    validExercises.map(
      async (programExercise) => ({
        programExercise,
        exercise:
          await getExercise(
            programExercise.exerciseId,
          ),
      }),
    ),
  );
}

/* ============================================================
   WORKOUT SESSIONS
   ============================================================ */

export async function createWorkoutSession(
  session: Omit<
    WorkoutSession,
    "id" | "createdAt" | "updatedAt"
  >,
): Promise<string> {
  const sessionRef = doc(
    collection(
      db,
      "workoutSessions",
    ),
  );

  await setDoc(
    sessionRef,
    {
      ...session,
      createdAt:
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    },
  );

  return sessionRef.id;
}

export async function getWorkoutSession(
  sessionId: string,
): Promise<WorkoutSession | null> {
  const snapshot = await getDoc(
    doc(
      db,
      "workoutSessions",
      sessionId,
    ),
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<
      WorkoutSession,
      "id"
    >),
  };
}

export async function updateWorkoutSession(
  sessionId: string,
  updates: Partial<
    Omit<
      WorkoutSession,
      "id" | "createdAt" | "updatedAt"
    >
  >,
): Promise<void> {
  const cleanUpdates =
    Object.fromEntries(
      Object.entries(updates).filter(
        ([, value]) =>
          value !== undefined,
      ),
    );

  await updateDoc(
    doc(
      db,
      "workoutSessions",
      sessionId,
    ),
    {
      ...cleanUpdates,
      updatedAt:
        serverTimestamp(),
    },
  );
}

export async function completeWorkoutSession(
  sessionId: string,
): Promise<void> {
  await updateDoc(
    doc(
      db,
      "workoutSessions",
      sessionId,
    ),
    {
      status: "completed" satisfies WorkoutSessionStatus,
      mode: "complete",
      completedAt:
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    },
  );
}

export interface WorkoutSetRecord {
  id: string;

  exerciseId: string;
  setNumber: number;

  targetReps?: number;
  targetDurationSeconds?: number;

  actualReps?: number;
  actualDurationSeconds?: number;

  completed: boolean;

  startedAt?: unknown;
  completedAt?: unknown;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function createWorkoutSet(
  sessionId: string,
  set: Omit<
    WorkoutSetRecord,
    "id" | "createdAt" | "updatedAt"
  >,
): Promise<string> {
  const setRef = doc(
    collection(
      db,
      "workoutSessions",
      sessionId,
      "sets",
    ),
  );

  await setDoc(
    setRef,
    {
      ...set,
      createdAt:
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    },
  );

  return setRef.id;
}

export async function updateWorkoutSet(
  sessionId: string,
  setId: string,
  updates: Partial<
    Omit<
      WorkoutSetRecord,
      "id" | "createdAt" | "updatedAt"
    >
  >,
): Promise<void> {
  const cleanUpdates =
    Object.fromEntries(
      Object.entries(updates).filter(
        ([, value]) =>
          value !== undefined,
      ),
    );

  await updateDoc(
    doc(
      db,
      "workoutSessions",
      sessionId,
      "sets",
      setId,
    ),
    {
      ...cleanUpdates,
      updatedAt:
        serverTimestamp(),
    },
  );
}
