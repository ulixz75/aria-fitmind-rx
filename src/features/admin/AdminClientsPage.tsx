import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  assignProgramToClient,
  getActiveProgramAssignment,
  getClientProfile,
  listTrainingPrograms,
  listUsers,
} from "../../services/firestore";

import type {
  ClientProfile,
  UserDoc,
} from "../../types/models";

import type { TrainingProgram } from "../../types/programs";
import { useAuth } from "../../context/AuthContext";

interface ClientRecord {
  user: UserDoc;
  profile: ClientProfile | null;
  activeAssignment: {
    id: string;
    clientId: string;
    programId: string;
    assignedBy: string;
    startDate: unknown;
    status: "active" | "completed" | "cancelled" | "replaced";
    createdAt?: unknown;
    updatedAt?: unknown;
  } | null;
  activeProgram: TrainingProgram | null;
}

export function AdminClientsPage() {
  const { firebaseUser } = useAuth();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedClient, setSelectedClient] =
    useState<ClientRecord | null>(null);

  const [selectedProgramId, setSelectedProgramId] =
    useState("");

  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);

    try {
      const [users, trainingPrograms] =
        await Promise.all([
          listUsers("active"),
          listTrainingPrograms(),
        ]);

      const activeClients = users.filter(
        (user) => user.role === "client",
      );

      const clientRecords = await Promise.all(
        activeClients.map(async (user) => {
          const [
            profile,
            activeAssignment,
          ] = await Promise.all([
            getClientProfile(user.uid),
            getActiveProgramAssignment(user.uid),
          ]);

          const activeProgram =
            activeAssignment
              ? trainingPrograms.find(
                  (program) =>
                    program.id ===
                    activeAssignment.programId,
                ) ?? null
              : null;

          return {
            user,
            profile,
            activeAssignment,
            activeProgram,
          };
        }),
      );

      setPrograms(trainingPrograms);
      setClients(clientRecords);
    } catch (error) {
      console.error(
        "Failed to load clients:",
        error,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return clients;
    }

    return clients.filter((client) => {
      const searchable = [
        client.user.displayName,
        client.user.email,
        client.profile?.displayName,
        client.profile?.email,
        client.profile?.fitnessLevel,
        ...(client.profile?.primaryGoals ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [clients, search]);

  function openAssignment(client: ClientRecord) {
    setSelectedClient(client);

    setSelectedProgramId(
      client.activeProgram?.id ?? "",
    );

    const existingStartDate =
      client.activeAssignment?.startDate;

    if (
      existingStartDate &&
      typeof existingStartDate === "object" &&
      "toDate" in existingStartDate
    ) {
      const dateValue =
        (
          existingStartDate as {
            toDate: () => Date;
          }
        ).toDate();

      setStartDate(
        dateValue
          .toISOString()
          .slice(0, 10),
      );
    } else {
      setStartDate(
        new Date()
          .toISOString()
          .slice(0, 10),
      );
    }
  }

  function closeAssignment() {
    if (saving) {
      return;
    }

    setSelectedClient(null);
    setSelectedProgramId("");
  }

  async function handleAssignProgram() {
  if (!selectedClient) {
    return;
  }

  if (!selectedProgramId) {
    alert("Select a training program.");
    return;
  }

  if (!startDate) {
    alert("Select a start date.");
    return;
  }

  const adminUid = firebaseUser?.uid;

  if (!adminUid) {
    alert("Unable to identify the administrator.");
    return;
  }

  setSaving(true);

  try {
    await assignProgramToClient(
      selectedClient.user.uid,
      selectedProgramId,
      adminUid,
      new Date(`${startDate}T00:00:00`),
    );

    await loadData();

    setSelectedClient(null);
    setSelectedProgramId("");

    alert("Program assigned successfully.");
  } catch (error) {
    console.error(
      "Failed to assign program:",
      error,
    );

    alert(
      error instanceof Error
        ? error.message
        : "Unable to assign the program.",
    );
  } finally {
    setSaving(false);
  }
}

  return (
    <div className="content">
      <div className="page-title">
        <span className="eyebrow">
          Admin / clients
        </span>

        <h1>Clients.</h1>

        <p className="muted">
          Review active clients and manage their
          current training programs.
        </p>
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={17} />

          <input
            type="search"
            placeholder="Search clients by name or email…"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="status-badge active">
          {filteredClients.length} clients
        </div>
      </div>

      {loading ? (
        <section className="section-card">
          <div className="empty">
            Loading clients…
          </div>
        </section>
      ) : filteredClients.length === 0 ? (
        <section className="section-card">
          <div className="empty">
            No active clients found.
          </div>
        </section>
      ) : (
        <section className="client-grid">
          {filteredClients.map((client) => (
            <article
              className="section-card client-card"
              key={client.user.uid}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "14px",
                }}
              >
                <div>
                  <span className="eyebrow">
                    Active client
                  </span>

                  <h2>
                    {client.user.displayName ||
                      "Unnamed client"}
                  </h2>

                  <p
                    className="muted"
                    style={{
                      margin: "0",
                      fontSize: "12px",
                    }}
                  >
                    {client.user.email}
                  </p>
                </div>

                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    background:
                      "linear-gradient(135deg, #7cf7d418, #6aa8ff18)",
                    border:
                      "1px solid #ffffff10",
                    color: "#7cf7d4",
                  }}
                >
                  <UserRound size={20} />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "9px",
                  marginTop: "18px",
                }}
              >
                <div
                  style={{
                    padding: "11px",
                    borderRadius: "13px",
                    background: "#ffffff05",
                    border:
                      "1px solid #ffffff08",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      color: "#7f8997",
                      fontSize: "9px",
                      textTransform:
                        "uppercase",
                      letterSpacing: ".08em",
                    }}
                  >
                    Fitness level
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "5px",
                      fontSize: "12px",
                      textTransform:
                        "capitalize",
                    }}
                  >
                    {client.profile?.fitnessLevel ??
                      "Not set"}
                  </strong>
                </div>

                <div
                  style={{
                    padding: "11px",
                    borderRadius: "13px",
                    background: "#ffffff05",
                    border:
                      "1px solid #ffffff08",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      color: "#7f8997",
                      fontSize: "9px",
                      textTransform:
                        "uppercase",
                      letterSpacing: ".08em",
                    }}
                  >
                    Goal
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "5px",
                      fontSize: "12px",
                    }}
                  >
                    {client.profile?.primaryGoals?.[0] ??
                      "Not set"}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  padding: "14px",
                  borderRadius: "15px",
                  background:
                    client.activeProgram
                      ? "#7cf7d408"
                      : "#ffffff04",
                  border:
                    client.activeProgram
                      ? "1px solid #7cf7d41a"
                      : "1px solid #ffffff08",
                }}
              >
                <span className="eyebrow">
                  Current program
                </span>

                {client.activeProgram ? (
                  <>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "14px",
                      }}
                    >
                      {client.activeProgram.name}
                    </strong>

                    <span
                      style={{
                        display: "block",
                        marginTop: "5px",
                        color: "#8e9aaa",
                        fontSize: "11px",
                      }}
                    >
                      {client.activeProgram.durationWeeks}{" "}
                      weeks ·{" "}
                      {client.activeProgram.difficulty}
                    </span>
                  </>
                ) : (
                  <span
                    style={{
                      color: "#7f8997",
                      fontSize: "11px",
                    }}
                  >
                    No active program assigned.
                  </span>
                )}
              </div>

              <button
                type="button"
                className="secondary-button"
                style={{
                  width: "100%",
                  marginTop: "16px",
                }}
                onClick={() =>
                  openAssignment(client)
                }
              >
                <Dumbbell size={16} />

                {client.activeProgram
                  ? "Change Program"
                  : "Assign Program"}

                <ChevronRight
                  size={16}
                  style={{
                    marginLeft: "auto",
                  }}
                />
              </button>
            </article>
          ))}
        </section>
      )}

      {selectedClient && (
        <div
          className="exercise-modal-backdrop"
          onClick={closeAssignment}
        >
          <div
            className="exercise-modal"
            style={{
              display: "block",
              width:
                "min(620px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={closeAssignment}
              disabled={saving}
            >
              <X size={20} />
            </button>

            <div
              style={{
                padding: "32px",
              }}
            >
              <span className="eyebrow">
                Program assignment
              </span>

              <h2
                style={{
                  fontSize: "28px",
                }}
              >
                Assign Program
              </h2>

              <p className="muted">
                Choose the training program for{" "}
                <strong>
                  {selectedClient.user.displayName ||
                    selectedClient.user.email}
                </strong>
                .
              </p>

              <div
                style={{
                  marginTop: "24px",
                  padding: "15px",
                  borderRadius: "16px",
                  background: "#ffffff05",
                  border:
                    "1px solid #ffffff08",
                }}
              >
                <span className="eyebrow">
                  Client
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: "14px",
                  }}
                >
                  {selectedClient.user.displayName ||
                    "Unnamed client"}
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: "4px",
                    color: "#8e9aaa",
                    fontSize: "11px",
                  }}
                >
                  {selectedClient.user.email}
                </span>
              </div>

              {selectedClient.activeProgram && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "14px",
                    borderRadius: "14px",
                    background: "#7cf7d408",
                    border:
                      "1px solid #7cf7d41a",
                  }}
                >
                  <span className="eyebrow">
                    Current program
                  </span>

                  <strong>
                    {
                      selectedClient
                        .activeProgram
                        .name
                    }
                  </strong>

                  <p
                    className="muted"
                    style={{
                      margin:
                        "5px 0 0",
                      fontSize:
                        "11px",
                    }}
                  >
                    Assigning another program will
                    automatically mark the current one
                    as replaced.
                  </p>
                </div>
              )}

              <div
                className="form-grid"
                style={{
                  marginTop: "22px",
                }}
              >
                <label className="span-2">
                  Training program

                  <select
                    value={selectedProgramId}
                    onChange={(event) =>
                      setSelectedProgramId(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Select a program…
                    </option>

                    {programs
                      .filter(
                        (program) =>
                          program.active,
                      )
                      .map(
                        (program) => (
                          <option
                            key={program.id}
                            value={program.id}
                          >
                            {program.name} ·{" "}
                            {program.difficulty}
                          </option>
                        ),
                      )}
                  </select>
                </label>

                <label className="span-2">
                  Start date

                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <div
                className="notice"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "9px",
                }}
              >
                <CalendarDays
                  size={16}
                  style={{
                    flex: "0 0 auto",
                    color: "#7cf7d4",
                  }}
                />

                <span>
                  The selected program becomes the
                  client's active training program
                  starting on the chosen date.
                </span>
              </div>

              <div
                className="actions"
                style={{
                  marginTop: "24px",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeAssignment}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    void handleAssignProgram()
                  }
                  disabled={
                    saving ||
                    !selectedProgramId
                  }
                >
                  {saving
                    ? "Assigning…"
                    : selectedClient.activeProgram
                      ? "Change Program"
                      : "Assign Program"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}