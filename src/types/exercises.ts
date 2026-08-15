export interface ExerciseMedia {
  classic?: {
    start?: string;
    peak?: string;
  } | null;

  flat?: {
    start?: string;
    peak?: string;
  } | null;

  animation?: string | null;
}

export interface Exercise {
  id: string;

  name: string;
  slug: string;

  description: string;

  category: string;
  bodyPart: string;
  forceType: string;
  mechanic: string;
  difficulty: string;

  primaryMuscles: string[];
  secondaryMuscles: string[];

  equipment: string[];

  instructions: string[];
  tips: string[];

  goals: string[];
  tags: string[];
  synonyms: string[];

  isUnilateral: boolean;
  isBodyweight: boolean;

  animation: boolean;
  animationType: string;

  met: number | null;

  media: ExerciseMedia;

  active: boolean;

  source: string;

  updatedAt?: unknown;
}
