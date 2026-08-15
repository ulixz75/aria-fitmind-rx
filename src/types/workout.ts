export type WorkoutSessionMode =
  | "voice"
  | "visual"
  | "complete";

export type WorkoutSessionStatus =
  | "ready"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export interface WorkoutSession {
  id: string;

  clientId: string;
  programId: string;
  programDayId: string;

  week: number;
  dayNumber: number;

  workoutDurationSeconds: number;

  ariaVoiceDurationSeconds: number;

  elapsedSeconds: number;

  ariaElapsedSeconds: number;

  mode: WorkoutSessionMode;

  status: WorkoutSessionStatus;

  currentExerciseIndex: number;
  currentSetNumber: number;

  startedAt?: unknown;
  completedAt?: unknown;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkoutExerciseState {
  exerciseId: string;

  order: number;

  sets: number;

  reps?: number;

  durationSeconds?: number;

  restSeconds: number;

  completedSets: number;

  completed: boolean;
}