import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Dumbbell,
  Play,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  ExerciseDetailContent,
  type ExerciseDetailView,
} from "./ExerciseDetailPage";

import { useAuth } from "../../context/AuthContext";

import {
  getActiveProgramForClient,
  getProgramDayExercises,
  listProgramDays,
  resolveStorageUrl,
} from "../../services/firestore";

import type { Exercise } from "../../types/exercises";

import type {
  ProgramDay,
  ProgramExercise,
  TrainingProgram,
} from "../../types/programs";

interface ProgramExerciseView {
  programExercise: ProgramExercise;
  exercise: Exercise | null;
  previewUrl: string | null;
}

interface ProgramDayView extends ProgramDay {
  exerciseViews: ProgramExerciseView[];
}

export function MyProgramPage() {
  const { firebaseUser } = useAuth();

  const [program, setProgram] =
    useState<TrainingProgram | null>(null);

  const [programDays, setProgramDays] =
    useState<ProgramDayView[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseDetailView | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  useEffect(() => {
    const uid = firebaseUser?.uid;

    if (!uid) {
      setProgram(null);
      setProgramDays([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProgram(clientId: string) {
      setLoading(true);
      setError(null);

      try {
        const activeProgram =
          await getActiveProgramForClient(
            clientId,
          );

        if (!activeProgram) {
          if (!cancelled) {
            setProgram(null);
            setProgramDays([]);
          }

          return;
        }

        if (!activeProgram.program) {
          throw new Error(
            "Your assigned program could not be found.",
          );
        }

        const days = await listProgramDays(
          activeProgram.program.id,
        );

        const dayViews =
          await Promise.all(
            days.map(async (day) => {
              const exerciseViews =
                await getProgramDayExercises(
                  day,
                );

              const resolvedExercises =
                await Promise.all(
                  exerciseViews.map(
                    async ({
                      programExercise,
                      exercise,
                    }) => {
                      const previewPath =
                        exercise?.media?.classic?.start ??
                        exercise?.media?.flat?.start ??
                        exercise?.media?.classic?.peak ??
                        exercise?.media?.flat?.peak ??
                        null;

                      const previewUrl =
                        await resolveStorageUrl(
                          previewPath,
                        );

                      return {
                        programExercise,
                        exercise,
                        previewUrl,
                      };
                    },
                  ),
                );

              return {
                ...day,
                exerciseViews:
                  resolvedExercises,
              };
            }),
          );

        if (!cancelled) {
          setProgram(
            activeProgram.program,
          );

          setProgramDays(
            dayViews,
          );
        }
      } catch (err) {
        console.error(
          "Failed to load client program:",
          err,
        );

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your program.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProgram(uid);

    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid]);

  const todayIndex = useMemo(() => {
    if (programDays.length === 0) {
      return 0;
    }

    /*
     * Temporary behavior:
     * show the first scheduled day.
     *
     * The Workout Session Engine will later
     * determine the real current day.
     */
    return 0;
  }, [programDays]);

  /* ==========================================================
     OPEN EXERCISE DETAIL (modal)
     Uses already-loaded exercise when available to avoid
     an extra Firestore read; otherwise falls back to
     resolveStorageUrl for animation/gif.
     ========================================================== */

  async function handleViewExercise(
    view: ProgramExerciseView,
  ) {
    // If we already have the exercise doc, reuse it
    const baseExercise = view.exercise;

    // Exercise doc missing (deleted/unavailable)
    if (!baseExercise) {
      // Still show a minimal fallback modal
      setSelectedExercise({
        id: view.programExercise.exerciseId,
        name: "Exercise unavailable",
        slug: "",
        description:
          "This exercise could not be loaded. It may have been removed from the library.",
        category: "",
        bodyPart: "",
        forceType: "",
        mechanic: "",
        difficulty: "",
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: [],
        instructions: [],
        tips: [],
        goals: [],
        tags: [],
        synonyms: [],
        isUnilateral: false,
        isBodyweight: false,
        animation: false,
        animationType: "",
        met: null,
        media: {},
        active: false,
        source: "",
        previewUrl: view.previewUrl,
        animationUrl: null,
      });
      return;
    }

    setDetailLoading(true);

    try {
      const previewPath =
        baseExercise.media?.classic?.start ??
        baseExercise.media?.flat?.start ??
        baseExercise.media?.classic?.peak ??
        baseExercise.media?.flat?.peak ??
        baseExercise.media?.thumbnail ??
        null;

      // previewUrl already resolved for the card; re-use or resolve
      const previewUrl =
        view.previewUrl ??
        (await resolveStorageUrl(previewPath));

      const animationUrl =
        await resolveStorageUrl(
          baseExercise.media?.animation ??
            baseExercise.media?.gif ??
            null,
        );

      setSelectedExercise({
        ...baseExercise,
        previewUrl,
        animationUrl,
      });
    } finally {
      setDetailLoading(false);
    }
  }

  function closeExerciseDetail() {
    setSelectedExercise(null);
  }

  /* Close on ESC */
  useEffect(() => {
    if (!selectedExercise) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeExerciseDetail();
    }

    window.addEventListener(
      "keydown",
      onKeyDown,
    );
    // Lock scroll
    const prevOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown,
      );
      document.body.style.overflow =
        prevOverflow;
    };
  }, [selectedExercise]);

  if (loading) {
    return (
      <div className="content">
        <div className="page-title">
          <span className="eyebrow">
            Client / My Program
          </span>

          <h1>
            Loading your program…
          </h1>

          <p className="muted">
            Preparing your training plan.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content">
        <section className="section-card">
          <span className="eyebrow danger">
            Program error
          </span>

          <h2>
            We couldn't load your program.
          </h2>

          <p className="muted">
            {error}
          </p>
        </section>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="content">
        <section className="hero-card">
          <div>
            <span className="eyebrow">
              My Program
            </span>

            <h1>
              Your training plan isn't
              assigned yet.
            </h1>

            <p>
              Once your coach assigns a
              training program, it will
              appear here automatically.
            </p>
          </div>

          <div className="aria-orb">
            <Dumbbell size={42} />
          </div>
        </section>
      </div>
    );
  }

  const currentDay =
    programDays[todayIndex] ?? null;

  return (
    <div className="content">
      <div className="page-title">
        <span className="eyebrow">
          Client / My Program
        </span>

        <h1>{program.name}</h1>

        <p className="muted">
          {program.description ||
            "Your assigned training program."}
        </p>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <Dumbbell size={18} />

          <span>Goal</span>

          <strong>
            {program.goal}
          </strong>
        </article>

        <article className="stat-card">
          <CalendarDays size={18} />

          <span>Program length</span>

          <strong>
            {program.durationWeeks} weeks
          </strong>
        </article>

        <article className="stat-card">
          <Clock3 size={18} />

          <span>Training days</span>

          <strong>
            {programDays.length}
          </strong>
        </article>
      </section>

      {currentDay && (
        <section className="section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                Current session
              </span>

              <h2>
                {currentDay.name}
              </h2>

              <p
                className="muted"
                style={{
                  margin: "4px 0 0",
                  fontSize: "12px",
                }}
              >
                {currentDay.focus ||
                  "Today's training session"}
              </p>
            </div>

            <span className="status-badge active">
              Week {currentDay.week}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            {currentDay.exerciseViews.map(
              (
                exerciseView,
              ) => {
                const exercise =
                  exerciseView.exercise;

                const config =
                  exerciseView.programExercise;

                return (
                  <article
                    key={`${currentDay.id}-${config.order}`}
                    className="section-card"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "72px minmax(0, 1fr) auto",
                      gap: "14px",
                      alignItems: "center",
                      padding: "13px",
                    }}
                  >
                    <div
                      style={{
                        width: "72px",
                        height: "72px",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                        borderRadius: "14px",
                        background:
                          "#ffffff05",
                        border:
                          "1px solid #ffffff08",
                      }}
                    >
                      {exerciseView.previewUrl ? (
                        <img
                          src={
                            exerciseView.previewUrl
                          }
                          alt={
                            exercise?.name ??
                            "Exercise"
                          }
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit:
                              "contain",
                          }}
                        />
                      ) : (
                        <Dumbbell
                          size={24}
                        />
                      )}
                    </div>

                    <div>
                      <span className="eyebrow">
                        Exercise{" "}
                        {config.order}
                      </span>

                      <strong
                        style={{
                          display: "block",
                          fontSize: "14px",
                        }}
                      >
                        {exercise?.name ??
                          "Exercise unavailable"}
                      </strong>

                      <div
                        className="exercise-meta"
                        style={{
                          marginTop: "7px",
                        }}
                      >
                        <span>
                          {config.sets} sets
                        </span>

                        {config.reps !==
                          undefined && (
                          <span>
                            {config.reps} reps
                          </span>
                        )}

                        {config.durationSeconds !==
                          undefined && (
                          <span>
                            {
                              config.durationSeconds
                            }{" "}
                            sec
                          </span>
                        )}

                        <span>
                          Rest{" "}
                          {
                            config.restSeconds
                          }{" "}
                          sec
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={detailLoading}
                      onClick={() =>
                        void handleViewExercise(
                          exerciseView,
                        )
                      }
                    >
                      View
                      <ChevronRight
                        size={15}
                      />
                    </button>
                  </article>
                );
              },
            )}
          </div>

          <Link
            to="/workout"
            className="primary-button"
            style={{
              marginTop: "18px",
              width: "100%",
            }}
          >
            <Play size={17} />
            Start with ARIA
          </Link>
        </section>
      )}

      {programDays.length > 1 && (
        <section className="section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                Program schedule
              </span>

              <h2>
                Training days
              </h2>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "8px",
              marginTop: "16px",
            }}
          >
            {programDays.map(
              (day, index) => (
                <div
                  key={day.id}
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap: "12px",
                    padding: "13px",
                    borderRadius: "14px",
                    background:
                      index === todayIndex
                        ? "#7cf7d408"
                        : "#ffffff04",
                    border:
                      index === todayIndex
                        ? "1px solid #7cf7d41a"
                        : "1px solid #ffffff08",
                  }}
                >
                  <div>
                    <span className="eyebrow">
                      Week {day.week}
                      {" · "}
                      Day {day.dayNumber}
                    </span>

                    <strong
                      style={{
                        display: "block",
                        fontSize: "13px",
                      }}
                    >
                      {day.name}
                    </strong>
                  </div>

                  <span
                    style={{
                      color: "#7f8997",
                      fontSize: "10px",
                    }}
                  >
                    {
                      day.exercises
                        .length
                    }{" "}
                    exercises
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      {/* ======================================================
          EXERCISE DETAIL MODAL (client-friendly)
          ====================================================== */}

      {selectedExercise && (
        <div
          className="exercise-modal-backdrop"
          onClick={closeExerciseDetail}
          role="presentation"
        >
          <div
            className="exercise-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
            aria-label={selectedExercise.name}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close exercise details"
              onClick={closeExerciseDetail}
            >
              <X size={20} />
            </button>

            <ExerciseDetailContent
              exercise={selectedExercise}
            />
          </div>
        </div>
      )}
    </div>
  );
}