export type UserRole = "client" | "admin";
export type AccountStatus = "pending" | "active" | "suspended";
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  primaryGoal?: string;

  photoURL?: string;
  role: UserRole;
  status: AccountStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}
export interface ClientProfile {
  uid: string;

  displayName: string;
  email: string;
  preferredLanguage?: "es" | "en" | "auto";

  // Personal information
  sex?: "male" | "female" | "prefer_not_to_say";
  age?: number;

  // Body information
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  bodyFatPercent?: number;

  // Training information
  fitnessLevel?: "beginner" | "intermediate" | "advanced";
  primaryGoals?: string[];

  trainingDaysPerWeek?: number;
  preferredSessionMinutes?: number;

  availableEquipment?: string[];

  exercisesPreferred?: string[];
  exercisesAvoid?: string[];

  restrictions?: string[];

  createdAt?: unknown;
  updatedAt?: unknown;
}
