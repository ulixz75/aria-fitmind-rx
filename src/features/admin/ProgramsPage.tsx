import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Dumbbell,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

import {
  createTrainingProgram,
  deleteTrainingProgram,
  listExercises,
  listProgramDays,
  listTrainingPrograms,
  replaceProgramDays,
  updateTrainingProgram,
} from "../../services/firestore";

import type { Exercise } from "../../types/exercises";

import type {
  ProgramExercise,
  TrainingProgram,
} from "../../types/programs";

type ExerciseMode = "reps" | "time";

interface DraftProgramExercise extends ProgramExercise {
  mode: ExerciseMode;
}

interface DraftProgramDay {
  localId: string;
  week: number;
  dayNumber: number;
  name: string;
  focus: string;
  exercises: DraftProgramExercise[];
}

function createLocalId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function createEmptyDay(
  week: number,
  dayNumber: number,
): DraftProgramDay {
  return {
    localId: createLocalId(),
    week,
    dayNumber,
    name: `Day ${dayNumber}`,
    focus: "",
    exercises: [],
  };
}

export function ProgramsPage() {
  const { profile, firebaseUser } = useAuth();

  const [programs, setPrograms] = useState<TrainingProgram[]>(
    [],
  );

  const [exercises, setExercises] = useState<Exercise[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showBuilder, setShowBuilder] = useState(false);

  const [editingProgramId, setEditingProgramId] =
    useState<string | null>(null);

  const [exercisePickerDayId, setExercisePickerDayId] =
    useState<string | null>(null);

  const [exerciseSearch, setExerciseSearch] =
    useState("");

  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");
  const [goal, setGoal] = useState("");

  const [difficulty, setDifficulty] =
    useState<
      "beginner" | "intermediate" | "advanced"
    >("beginner");

  const [durationWeeks, setDurationWeeks] =
    useState(4);

  const [days, setDays] = useState<
    DraftProgramDay[]
  >([
    createEmptyDay(1, 1),
  ]);

  async function loadData() {
    setLoading(true);

    try {
      const [programData, exerciseData] =
        await Promise.all([
          listTrainingPrograms(),
          listExercises(),
        ]);

      setPrograms(programData);
      setExercises(exerciseData);
    } catch (error) {
      console.error(
        "Failed to load programs:",
        error,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedExercisePickerDay =
    days.find(
      (day) =>
        day.localId ===
        exercisePickerDayId,
    ) ?? null;

  const filteredExercises = useMemo(() => {
    const term = exerciseSearch
      .trim()
      .toLowerCase();

    if (!term) {
      return exercises;
    }

    return exercises.filter(
      (exercise) => {
        const content = [
          exercise.name,
          exercise.category,
          exercise.bodyPart,
          exercise.difficulty,
          ...exercise.primaryMuscles,
          ...exercise.secondaryMuscles,
          ...exercise.equipment,
          ...exercise.goals,
          ...exercise.tags,
          ...exercise.synonyms,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return content.includes(term);
      },
    );
  }, [exerciseSearch, exercises]);

  function resetBuilder() {
    setEditingProgramId(null);

    setName("");
    setDescription("");
    setGoal("");
    setDifficulty("beginner");
    setDurationWeeks(4);

    setDays([
      createEmptyDay(1, 1),
    ]);

    setExerciseSearch("");
    setExercisePickerDayId(null);
  }

  function openBuilder() {
    resetBuilder();
    setShowBuilder(true);
  }

  function closeBuilder() {
    if (saving) {
      return;
    }

    setShowBuilder(false);
    setEditingProgramId(null);
    setExercisePickerDayId(null);
  }

  async function openEditBuilder(
    program: TrainingProgram,
  ) {
    try {
      setSaving(true);

      const programDays =
        await listProgramDays(
          program.id,
        );

      setEditingProgramId(
        program.id,
      );

      setName(program.name);
      setDescription(
        program.description ?? "",
      );
      setGoal(program.goal);
      setDifficulty(
        program.difficulty,
      );
      setDurationWeeks(
        program.durationWeeks,
      );

      const draftDays: DraftProgramDay[] =
        programDays.map(
          (day) => ({
            localId:
              createLocalId(),
            week: day.week,
            dayNumber:
              day.dayNumber,
            name: day.name,
            focus: day.focus,
            exercises:
              day.exercises.map(
                (exercise) => ({
                  ...exercise,
                  mode:
                    exercise.durationSeconds !==
                    undefined
                      ? "time"
                      : "reps",
                }),
              ),
          }),
        );

      setDays(
        draftDays.length > 0
          ? draftDays
          : [createEmptyDay(1, 1)],
      );

      setExerciseSearch("");
      setExercisePickerDayId(null);
      setShowBuilder(true);
    } catch (error) {
      console.error(
        "Failed to load program:",
        error,
      );

      alert(
        "Unable to load this program.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProgram(
    program: TrainingProgram,
  ) {
    const confirmed =
      window.confirm(
        `Delete "${program.name}"?\n\nThis will also delete all training days associated with this program.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);

      await deleteTrainingProgram(
        program.id,
      );

      await loadData();
    } catch (error) {
      console.error(
        "Failed to delete program:",
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete the program.",
      );
    } finally {
      setSaving(false);
    }
  }

  function addDay() {
    const lastDay =
      days[days.length - 1];

    const nextDayNumber =
      lastDay
        ? lastDay.dayNumber + 1
        : 1;

    const nextWeek =
      lastDay
        ? lastDay.week
        : 1;

    setDays((current) => [
      ...current,
      createEmptyDay(
        nextWeek,
        nextDayNumber,
      ),
    ]);
  }

  function removeDay(
    localId: string,
  ) {
    setDays((current) =>
      current
        .filter(
          (day) =>
            day.localId !==
            localId,
        )
        .map(
          (day, index) => ({
            ...day,
            dayNumber:
              index + 1,
          }),
        ),
    );
  }

  function updateDay(
    localId: string,
    field: keyof DraftProgramDay,
    value:
      | string
      | number,
  ) {
    setDays((current) =>
      current.map((day) =>
        day.localId === localId
          ? {
              ...day,
              [field]: value,
            }
          : day,
      ),
    );
  }

  function addExerciseToDay(
    dayId: string,
    exercise: Exercise,
  ) {
    setDays((current) =>
      current.map((day) => {
        if (
          day.localId !==
          dayId
        ) {
          return day;
        }

        const nextOrder =
          day.exercises.length +
          1;

        const nextExercise:
          DraftProgramExercise = {
          exerciseId:
            exercise.id,
          order: nextOrder,
          sets: 3,
          reps: 10,
          restSeconds: 60,
          notes: "",
          mode: "reps",
        };

        return {
          ...day,
          exercises: [
            ...day.exercises,
            nextExercise,
          ],
        };
      }),
    );

    setExercisePickerDayId(
      null,
    );

    setExerciseSearch("");
  }

  function removeExerciseFromDay(
    dayId: string,
    order: number,
  ) {
    setDays((current) =>
      current.map((day) => {
        if (
          day.localId !==
          dayId
        ) {
          return day;
        }

        const exercisesAfterRemoval =
          day.exercises
            .filter(
              (exercise) =>
                exercise.order !==
                order,
            )
            .map(
              (exercise, index) => ({
                ...exercise,
                order: index + 1,
              }),
            );

        return {
          ...day,
          exercises:
            exercisesAfterRemoval,
        };
      }),
    );
  }

  function updateProgramExercise(
    dayId: string,
    order: number,
    field:
      | "sets"
      | "reps"
      | "durationSeconds"
      | "restSeconds"
      | "notes"
      | "mode",
    value:
      | number
      | string,
  ) {
    setDays((current) =>
      current.map((day) => {
        if (
          day.localId !==
          dayId
        ) {
          return day;
        }

        return {
          ...day,
          exercises:
            day.exercises.map(
              (exercise) => {
                if (
                  exercise.order !==
                  order
                ) {
                  return exercise;
                }

                if (
                  field ===
                  "mode"
                ) {
                  const nextMode =
                    value as ExerciseMode;

                  if (
                    nextMode ===
                    "time"
                  ) {
                    return {
                      ...exercise,
                      mode: nextMode,
                      reps:
                        undefined,
                      durationSeconds:
                        exercise.durationSeconds ??
                        30,
                    };
                  }

                  return {
                    ...exercise,
                    mode: nextMode,
                    durationSeconds:
                      undefined,
                    reps:
                      exercise.reps ??
                      10,
                  };
                }

                if (
                  field ===
                  "notes"
                ) {
                  return {
                    ...exercise,
                    notes:
                      String(value),
                  };
                }

                return {
                  ...exercise,
                  [field]:
                    Number(value),
                };
              },
            ),
        };
      }),
    );
  }

  function getExercise(
    exerciseId: string,
  ) {
    return exercises.find(
      (exercise) =>
        exercise.id ===
        exerciseId,
    );
  }

  async function saveProgram() {
    const cleanName =
      name.trim();

    if (!cleanName) {
      alert(
        "Enter a program name.",
      );
      return;
    }

    if (!goal.trim()) {
      alert(
        "Enter a program goal.",
      );
      return;
    }

    const adminUid =
      firebaseUser?.uid ??
      profile?.uid;

    if (!adminUid) {
      alert(
        "Unable to identify the administrator.",
      );
      return;
    }

    if (days.length === 0) {
      alert(
        "Add at least one training day.",
      );
      return;
    }

    const invalidDay =
      days.find(
        (day) =>
          !day.name.trim() ||
          day.exercises.length ===
            0,
      );

    if (invalidDay) {
      alert(
        `Complete "${invalidDay.name}" by adding at least one exercise.`,
      );
      return;
    }

    setSaving(true);

    try {
      const programPayload = {
        name: cleanName,
        description:
          description.trim(),
        goal: goal.trim(),
        difficulty,
        durationWeeks,
        active: true,
      };

      const dayPayloads =
        days.map((day) => ({
          programId:
            editingProgramId ??
            "",
          week: day.week,
          dayNumber:
            day.dayNumber,
          name:
            day.name.trim(),
          focus:
            day.focus.trim(),
          exercises:
            day.exercises.map(
              (exercise) => {
                const cleanExercise:
                  ProgramExercise =
                  {
                    exerciseId:
                      exercise.exerciseId,
                    order:
                      exercise.order,
                    sets:
                      exercise.sets,
                    restSeconds:
                      exercise.restSeconds,
                    notes:
                      exercise.notes?.trim() ??
                      "",
                  };

                if (
                  exercise.mode ===
                  "time"
                ) {
                  cleanExercise.durationSeconds =
                    exercise.durationSeconds ??
                    30;
                } else {
                  cleanExercise.reps =
                    exercise.reps ??
                    10;
                }

                return cleanExercise;
              },
            ),
        }));

      if (editingProgramId) {
        await updateTrainingProgram(
          editingProgramId,
          programPayload,
        );

        await replaceProgramDays(
          editingProgramId,
          dayPayloads.map(
            (day) => ({
              ...day,
              programId:
                editingProgramId,
            }),
          ),
        );
      } else {
        const programId =
          await createTrainingProgram(
            {
              ...programPayload,
              createdBy:
                adminUid,
            },
          );

        await replaceProgramDays(
          programId,
          dayPayloads.map(
            (day) => ({
              ...day,
              programId,
            }),
          ),
        );
      }

      alert(
        editingProgramId
          ? "Training program updated successfully."
          : "Training program created successfully.",
      );

      setShowBuilder(false);
      setEditingProgramId(null);
      setExercisePickerDayId(null);

      await loadData();
    } catch (error) {
      console.error(
        "Failed to save program:",
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to save the program.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content">
      <div className="page-title">
        <span className="eyebrow">
          Admin / programs
        </span>

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: "16px",
            alignItems:
              "flex-end",
          }}
        >
          <div>
            <h1>
              Training Programs.
            </h1>

            <p className="muted">
              Build structured training plans
              using the ARIA exercise library.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openBuilder}
          >
            <Plus size={17} />
            Create Program
          </button>
        </div>
      </div>

      {loading ? (
        <section className="section-card">
          <div className="empty">
            Loading programs…
          </div>
        </section>
      ) : programs.length ===
        0 ? (
        <section className="section-card">
          <div className="empty">
            No training programs have been created yet.
            <br />
            Create your first program to begin.
          </div>
        </section>
      ) : (
        <section className="program-grid">
          {programs.map(
            (program) => (
              <article
                className="section-card program-card"
                key={program.id}
              >
                <span className="eyebrow">
                  {program.difficulty}
                </span>

                <h2>
                  {program.name}
                </h2>

                <p className="muted">
                  {program.description ||
                    "No description."}
                </p>

                <div
                  className="exercise-meta"
                  style={{
                    marginTop:
                      "12px",
                  }}
                >
                  <span>
                    {program.goal}
                  </span>

                  <span>
                    {program.durationWeeks}{" "}
                    weeks
                  </span>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: "7px",
                    marginTop:
                      "18px",
                    color:
                      "#7f8997",
                    fontSize:
                      "11px",
                  }}
                >
                  <Dumbbell size={14} />

                  Program ID:
                  {" "}
                  {program.id}
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    gap: "8px",
                    marginTop:
                      "18px",
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      void openEditBuilder(
                        program,
                      )
                    }
                    disabled={saving}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="icon-button danger"
                    title={`Delete ${program.name}`}
                    onClick={() =>
                      void handleDeleteProgram(
                        program,
                      )
                    }
                    disabled={saving}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ),
          )}
        </section>
      )}

      {showBuilder && (
        <div
          className="exercise-modal-backdrop"
          onClick={
            closeBuilder
          }
        >
          <div
            className="exercise-modal"
            style={{
              display:
                "block",
              width:
                "min(1100px, 100%)",
              maxHeight:
                "94vh",
              overflowY:
                "auto",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={
                closeBuilder
              }
            >
              <X size={20} />
            </button>

            <div
              style={{
                padding:
                  "34px",
              }}
            >
              <span className="eyebrow">
                {editingProgramId
                  ? "Program Editor"
                  : "Program Builder"}
              </span>

              <h2
                style={{
                  fontSize:
                    "30px",
                  marginBottom:
                    "8px",
                }}
              >
                {editingProgramId
                  ? "Edit Training Program"
                  : "Create Training Program"}
              </h2>

              <p className="muted">
                Build the structure that ARIA
                will later use during coaching.
              </p>

              <div
                className="form-grid"
                style={{
                  marginTop:
                    "26px",
                }}
              >
                <label>
                  Program name

                  <input
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Strength Foundation"
                  />
                </label>

                <label>
                  Goal

                  <input
                    value={goal}
                    onChange={(event) =>
                      setGoal(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Strength"
                  />
                </label>

                <label>
                  Difficulty

                  <select
                    value={
                      difficulty
                    }
                    onChange={(
                      event,
                    ) =>
                      setDifficulty(
                        event.target
                          .value as
                          | "beginner"
                          | "intermediate"
                          | "advanced",
                      )
                    }
                  >
                    <option value="beginner">
                      Beginner
                    </option>

                    <option value="intermediate">
                      Intermediate
                    </option>

                    <option value="advanced">
                      Advanced
                    </option>
                  </select>
                </label>

                <label>
                  Duration

                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={
                      durationWeeks
                    }
                    onChange={(
                      event,
                    ) =>
                      setDurationWeeks(
                        Math.max(
                          1,
                          Number(
                            event
                              .target
                              .value,
                          ),
                        ),
                      )
                    }
                  />
                </label>

                <label className="span-2">
                  Description

                  <textarea
                    value={
                      description
                    }
                    onChange={(
                      event,
                    ) =>
                      setDescription(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Describe what this program is designed to achieve."
                  />
                </label>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginTop:
                    "32px",
                  marginBottom:
                    "14px",
                }}
              >
                <div>
                  <span className="eyebrow">
                    Schedule
                  </span>

                  <h2>
                    Training Days
                  </h2>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={addDay}
                >
                  <Plus size={16} />
                  Add Day
                </button>
              </div>

              <div
                style={{
                  display:
                    "grid",
                  gap: "16px",
                }}
              >
                {days.map(
                  (day) => (
                    <section
                      key={
                        day.localId
                      }
                      className="section-card"
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "flex-start",
                          gap:
                            "14px",
                        }}
                      >
                        <div>
                          <span className="eyebrow">
                            Week{" "}
                            {day.week}
                            {" · "}
                            Day{" "}
                            {day.dayNumber}
                          </span>

                          <h2>
                            {day.name}
                          </h2>
                        </div>

                        {days.length >
                          1 && (
                          <button
                            type="button"
                            className="icon-button danger"
                            title="Remove day"
                            onClick={() =>
                              removeDay(
                                day.localId,
                              )
                            }
                          >
                            <Trash2
                              size={16}
                            />
                          </button>
                        )}
                      </div>

                      <div
                        className="form-grid"
                        style={{
                          marginTop:
                            "14px",
                        }}
                      >
                        <label>
                          Week

                          <input
                            type="number"
                            min="1"
                            max={
                              durationWeeks
                            }
                            value={
                              day.week
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDay(
                                day.localId,
                                "week",
                                Math.max(
                                  1,
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                                ),
                              )
                            }
                          />
                        </label>

                        <label>
                          Day name

                          <input
                            value={
                              day.name
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDay(
                                day.localId,
                                "name",
                                event
                                  .target
                                  .value,
                              )
                            }
                            placeholder="Upper Body"
                          />
                        </label>

                        <label className="span-2">
                          Focus

                          <input
                            value={
                              day.focus
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDay(
                                day.localId,
                                "focus",
                                event
                                  .target
                                  .value,
                              )
                            }
                            placeholder="Chest + Back"
                          />
                        </label>
                      </div>

                      <div
                        style={{
                          marginTop:
                            "22px",
                          display:
                            "grid",
                          gap:
                            "10px",
                        }}
                      >
                        {day.exercises.length ===
                        0 ? (
                          <div className="empty">
                            No exercises added yet.
                          </div>
                        ) : (
                          day.exercises.map(
                            (
                              programExercise,
                            ) => {
                              const exercise =
                                getExercise(
                                  programExercise.exerciseId,
                                );

                              return (
                                <div
                                  key={`${day.localId}-${programExercise.order}`}
                                  style={{
                                    display:
                                      "grid",
                                    gridTemplateColumns:
                                      "minmax(220px, 1.6fr) repeat(4, minmax(85px, .6fr)) auto",
                                    gap:
                                      "10px",
                                    alignItems:
                                      "end",
                                    padding:
                                      "14px",
                                    borderRadius:
                                      "15px",
                                    background:
                                      "#ffffff05",
                                    border:
                                      "1px solid #ffffff08",
                                  }}
                                >
                                  <div>
                                    <span className="eyebrow">
                                      Exercise{" "}
                                      {
                                        programExercise.order
                                      }
                                    </span>

                                    <strong
                                      style={{
                                        display:
                                          "block",
                                        fontSize:
                                          "13px",
                                      }}
                                    >
                                      {exercise?.name ??
                                        "Unknown exercise"}
                                    </strong>

                                    <span
                                      style={{
                                        display:
                                          "block",
                                        marginTop:
                                          "4px",
                                        color:
                                          "#7f8997",
                                        fontSize:
                                          "10px",
                                      }}
                                    >
                                      {exercise?.equipment?.join(
                                        ", ",
                                      ) ||
                                        "No equipment"}
                                    </span>
                                  </div>

                                  <label>
                                    Mode

                                    <select
                                      value={
                                        programExercise.mode
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateProgramExercise(
                                          day.localId,
                                          programExercise.order,
                                          "mode",
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                    >
                                      <option value="reps">
                                        Reps
                                      </option>

                                      <option value="time">
                                        Time
                                      </option>
                                    </select>
                                  </label>

                                  <label>
                                    Sets

                                    <input
                                      type="number"
                                      min="1"
                                      value={
                                        programExercise.sets
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateProgramExercise(
                                          day.localId,
                                          programExercise.order,
                                          "sets",
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                    />
                                  </label>

                                  {programExercise.mode ===
                                  "reps" ? (
                                    <label>
                                      Reps

                                      <input
                                        type="number"
                                        min="1"
                                        value={
                                          programExercise.reps ??
                                          10
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateProgramExercise(
                                            day.localId,
                                            programExercise.order,
                                            "reps",
                                            event
                                              .target
                                              .value,
                                          )
                                        }
                                      />
                                    </label>
                                  ) : (
                                    <label>
                                      Seconds

                                      <input
                                        type="number"
                                        min="5"
                                        value={
                                          programExercise.durationSeconds ??
                                          30
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateProgramExercise(
                                            day.localId,
                                            programExercise.order,
                                            "durationSeconds",
                                            event
                                              .target
                                              .value,
                                          )
                                        }
                                      />
                                    </label>
                                  )}

                                  <label>
                                    Rest

                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        programExercise.restSeconds
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateProgramExercise(
                                          day.localId,
                                          programExercise.order,
                                          "restSeconds",
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    className="icon-button danger"
                                    title="Remove exercise"
                                    onClick={() =>
                                      removeExerciseFromDay(
                                        day.localId,
                                        programExercise.order,
                                      )
                                    }
                                  >
                                    <Trash2
                                      size={
                                        16
                                      }
                                    />
                                  </button>

                                  <label
                                    className="span-2"
                                    style={{
                                      gridColumn:
                                        "1 / -1",
                                    }}
                                  >
                                    Coach notes

                                    <input
                                      value={
                                        programExercise.notes ??
                                        ""
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateProgramExercise(
                                          day.localId,
                                          programExercise.order,
                                          "notes",
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      placeholder="Keep your core engaged."
                                    />
                                  </label>
                                </div>
                              );
                            },
                          )
                        )}

                        <button
                          type="button"
                          className="secondary-button"
                          style={{
                            width:
                              "100%",
                          }}
                          onClick={() =>
                            setExercisePickerDayId(
                              day.localId,
                            )
                          }
                        >
                          <Plus size={16} />
                          Add Exercise
                        </button>
                      </div>
                    </section>
                  ),
                )}
              </div>

              <div
                className="actions"
                style={{
                  marginTop:
                    "26px",
                  gap:
                    "10px",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeBuilder
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    void saveProgram()
                  }
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Saving..."
                    : editingProgramId
                      ? "Update Program"
                      : "Save Program"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {exercisePickerDayId && (
        <div
          className="exercise-modal-backdrop"
          style={{
            zIndex: 120,
          }}
          onClick={() =>
            setExercisePickerDayId(
              null,
            )
          }
        >
          <div
            className="exercise-modal"
            style={{
              display:
                "block",
              width:
                "min(720px, 100%)",
              maxHeight:
                "84vh",
              overflowY:
                "auto",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close exercise picker"
              onClick={() =>
                setExercisePickerDayId(
                  null,
                )
              }
            >
              <X size={20} />
            </button>

            <div
              style={{
                padding:
                  "30px",
              }}
            >
              <span className="eyebrow">
                Exercise Library
              </span>

              <h2>
                Select Exercise
              </h2>

              <p className="muted">
                Add an exercise to{" "}
                {
                  selectedExercisePickerDay?.name
                }.
              </p>

              <div
                className="search"
                style={{
                  marginTop:
                    "18px",
                  width:
                    "100%",
                }}
              >
                <Search size={17} />

                <input
                  type="search"
                  placeholder="Search exercises..."
                  value={
                    exerciseSearch
                  }
                  onChange={(
                    event,
                  ) =>
                    setExerciseSearch(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </div>

              <div
                style={{
                  display:
                    "grid",
                  gap: "8px",
                  marginTop:
                    "18px",
                }}
              >
                {filteredExercises.map(
                  (exercise) => (
                    <button
                      key={
                        exercise.id
                      }
                      type="button"
                      className="secondary-button"
                      style={{
                        width:
                          "100%",
                        justifyContent:
                          "space-between",
                        textAlign:
                          "left",
                      }}
                      onClick={() => {
                        if (
                          exercisePickerDayId
                        ) {
                          addExerciseToDay(
                            exercisePickerDayId,
                            exercise,
                          );
                        }
                      }}
                    >
                      <span
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap:
                            "10px",
                        }}
                      >
                        <Dumbbell
                          size={16}
                        />

                        <span>
                          <strong
                            style={{
                              display:
                                "block",
                              fontSize:
                                "12px",
                            }}
                          >
                            {
                              exercise.name
                            }
                          </strong>

                          <small
                            style={{
                              display:
                                "block",
                              marginTop:
                                "3px",
                              color:
                                "#7f8997",
                            }}
                          >
                            {
                              exercise.category
                            }
                            {" · "}
                            {
                              exercise.difficulty
                            }
                          </small>
                        </span>
                      </span>

                      <ChevronRight
                        size={16}
                      />
                    </button>
                  ),
                )}

                {filteredExercises.length ===
                  0 && (
                  <div className="empty">
                    No exercises found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}