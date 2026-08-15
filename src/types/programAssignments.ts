export type ProgramAssignmentStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "replaced";

export interface ProgramAssignment {
  id: string;

  clientId: string;
  programId: string;

  assignedBy: string;

  startDate: unknown;

  status: ProgramAssignmentStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
}