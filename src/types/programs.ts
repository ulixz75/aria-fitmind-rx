export interface ProgramExercise {
  exerciseId: string;
  order: number;

  sets: number;
  reps?: number;
  durationSeconds?: number;

  restSeconds: number;

  notes?: string;
}

export interface TrainingProgram {
  id: string;

  name: string;
  description: string;

  goal: string;
  difficulty: "beginner" | "intermediate" | "advanced";

  durationWeeks: number;

  createdBy: string;

  active: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProgramDay {
  id: string;

  programId: string;

  week: number;
  dayNumber: number;

  name: string;
  focus: string;

  exercises: ProgramExercise[];

  createdAt?: unknown;
  updatedAt?: unknown;
}