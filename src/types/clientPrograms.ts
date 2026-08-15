export interface ClientActiveProgram {
  clientId: string;
  programId: string;
  assignmentId: string;

  startDate: unknown;

  status: "active";

  updatedAt?: unknown;
}