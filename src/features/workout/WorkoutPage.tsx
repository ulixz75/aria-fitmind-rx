import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Headphones,
  Pause,
  Play,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext";

import {
  getActiveProgramForClient,
  getProgramDayExercises,
  listProgramDays,
  createWorkoutSession,
  updateWorkoutSession,
  completeWorkoutSession,
} from "../../services/firestore";

import type { Exercise } from "../../types/exercises";

import type {
  ProgramDay,
  ProgramExercise,
  TrainingProgram,
} from "../../types/programs";

import type {
  WorkoutSession,
} from "../../types/workout";

import {
  ARIA_MODEL,
  ARIA_INSTRUCTIONS,
} from "../../services/realtimeCoach";

interface SessionExercise {
  programExercise: ProgramExercise;
  exercise: Exercise | null;
}

interface SessionDay {
  day: ProgramDay;
  exercises: SessionExercise[];
}

/*
 * TEMPORARY DEVELOPMENT VALUES
 *
 * These will later come from the client's
 * subscription / entitlement.
 *
 * Workout:
 * 30 minutes
 *
 * ARIA voice:
 * 10 minutes
 */
const DEFAULT_WORKOUT_DURATION_SECONDS =
  30 * 60;

const DEFAULT_ARIA_VOICE_DURATION_SECONDS =
  10 * 60;

const ARIA_WARNING_SECONDS = 5 * 60;

type PageStatus =
  | "loading"
  | "ready"
  | "starting"
  | "active"
  | "paused"
  | "complete"
  | "error";

export function WorkoutPage() {
  const { firebaseUser } = useAuth();

  const [status, setStatus] =
    useState<PageStatus>("loading");

  const [message, setMessage] =
    useState(
      "Preparing your training session…",
    );

  const [program, setProgram] =
    useState<TrainingProgram | null>(
      null,
    );

  const [sessionDay, setSessionDay] =
    useState<SessionDay | null>(
      null,
    );

  const [session, setSession] =
    useState<WorkoutSession | null>(
      null,
    );

  const [sessionId, setSessionId] =
    useState<string | null>(null);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [ariaElapsedSeconds, setAriaElapsedSeconds] =
    useState(0);

  const [
    currentExerciseIndex,
    setCurrentExerciseIndex,
  ] = useState(0);

  const [currentSetNumber, setCurrentSetNumber] =
    useState(1);

  const [restRemainingSeconds, setRestRemainingSeconds] =
    useState(0);

  const [ariaWarningSent, setAriaWarningSent] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /*
   * ----------------------------------------------------------
   * LOAD ACTIVE PROGRAM
   * ----------------------------------------------------------
   */

  useEffect(() => {
    const uid = firebaseUser?.uid;

    if (!uid) {
      setStatus("error");
      setError(
        "You must be signed in to start a workout.",
      );
      return;
    }

    let cancelled = false;

    async function loadWorkout(clientId: string) {
      setStatus("loading");
      setError(null);

      try {
        const activeProgram =
          await getActiveProgramForClient(
            clientId,
          );

        if (!activeProgram?.program) {
          if (!cancelled) {
            setStatus("ready");
            setProgram(null);
            setSessionDay(null);
            setMessage(
              "No active training program is assigned to you yet.",
            );
          }

          return;
        }

        const days =
          await listProgramDays(
            activeProgram.program.id,
          );

        if (days.length === 0) {
          throw new Error(
            "Your program does not have any training days yet.",
          );
        }

        /*
         * Temporary behavior:
         * use the first scheduled day.
         *
         * The real Workout Session Engine will later
         * determine the actual day based on schedule/history.
         */
        const selectedDay = days[0];

        const exerciseViews =
          await getProgramDayExercises(
            selectedDay,
          );

        if (!cancelled) {
          setProgram(
            activeProgram.program,
          );

          setSessionDay({
            day: selectedDay,
            exercises: exerciseViews,
          });

          setStatus("ready");

          setMessage(
            "Your session is ready.",
          );
        }
      } catch (loadError) {
        console.error(
          "Failed to prepare workout:",
          loadError,
        );

        if (!cancelled) {
          setStatus("error");

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to prepare your workout.",
          );
        }
      }
    }

    void loadWorkout(uid);

    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid]);

  /*
   * ----------------------------------------------------------
   * CURRENT EXERCISE
   * ----------------------------------------------------------
   */

  const currentExercise =
    sessionDay?.exercises[
      currentExerciseIndex
    ] ?? null;

  const currentConfig =
    currentExercise?.programExercise ??
    null;

  /*
   * ----------------------------------------------------------
   * FORMATTERS
   * ----------------------------------------------------------
   */

  function formatTime(seconds: number) {
    const safeSeconds = Math.max(
      0,
      Math.floor(seconds),
    );

    const minutes = Math.floor(
      safeSeconds / 60,
    );

    const remaining =
      safeSeconds % 60;

    return `${String(minutes).padStart(
      2,
      "0",
    )}:${String(remaining).padStart(
      2,
      "0",
    )}`;
  }

  const workoutRemainingSeconds =
    Math.max(
      0,
      DEFAULT_WORKOUT_DURATION_SECONDS -
        elapsedSeconds,
    );

  const ariaRemainingSeconds =
    Math.max(
      0,
      DEFAULT_ARIA_VOICE_DURATION_SECONDS -
        ariaElapsedSeconds,
    );

  const ariaWarningThresholdReached =
    ariaElapsedSeconds >=
    DEFAULT_ARIA_VOICE_DURATION_SECONDS -
      ARIA_WARNING_SECONDS;

  /*
   * ----------------------------------------------------------
   * WORKOUT TIMER
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (
      status !== "active"
    ) {
      return;
    }

    const timer = window.setInterval(
      () => {
        setElapsedSeconds(
          (current) => {
            const next =
              current + 1;

            if (
              next >=
              DEFAULT_WORKOUT_DURATION_SECONDS
            ) {
              setStatus("complete");
              return DEFAULT_WORKOUT_DURATION_SECONDS;
            }

            return next;
          },
        );

        setAriaElapsedSeconds(
          (current) => {
            const next =
              current + 1;

            if (
              next >=
              DEFAULT_ARIA_VOICE_DURATION_SECONDS
            ) {
              return DEFAULT_ARIA_VOICE_DURATION_SECONDS;
            }

            return next;
          },
        );

        setRestRemainingSeconds(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        );
      },
      1000,
    );

    return () =>
      window.clearInterval(timer);
  }, [status]);

  /*
   * ----------------------------------------------------------
   * ARIA VOICE WINDOW
   * ----------------------------------------------------------
   *
   * The timer is controlled by the app.
   * GPT will never control the clock.
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (
      status !== "active"
    ) {
      return;
    }

    if (
      ariaWarningThresholdReached &&
      !ariaWarningSent
    ) {
      setAriaWarningSent(true);

      /*
       * Placeholder for GPT Realtime integration.
       *
       * Later this event will trigger:
       *
       * "You have five minutes left with ARIA."
       */

      console.info(
        "ARIA 5-minute warning threshold reached.",
      );
    }

    if (
      ariaElapsedSeconds >=
      DEFAULT_ARIA_VOICE_DURATION_SECONDS
    ) {
      /*
       * Voice mode ends automatically.
       * The workout itself continues visually.
       *
       * We don't change the workout status here.
       * Only the session mode changes.
       */

      setSession(
        (current) =>
          current
            ? {
                ...current,
                mode: "visual",
              }
            : current,
      );
    }
  }, [
    status,
    ariaElapsedSeconds,
    ariaWarningThresholdReached,
    ariaWarningSent,
  ]);

  /*
   * ----------------------------------------------------------
   * WORKOUT COMPLETE
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (
      status !== "complete" ||
      !sessionId
    ) {
      return;
    }

    void completeWorkoutSession(
      sessionId,
    ).catch((completeError) => {
      console.error(
        "Failed to complete workout session:",
        completeError,
      );
    });
  }, [status, sessionId]);

  /*
   * ----------------------------------------------------------
   * START SESSION
   * ----------------------------------------------------------
   */

  async function startSession() {
    const uid =
      firebaseUser?.uid;

    if (!uid) {
      setStatus("error");
      setError(
        "You must be signed in to start a workout.",
      );
      return;
    }

    if (
      !program ||
      !sessionDay ||
      !currentExercise
    ) {
      setStatus("error");
      setError(
        "Your workout is not ready yet.",
      );
      return;
    }

    setStatus("starting");
    setMessage(
      "Starting your workout session…",
    );

    try {
      const workoutSession: Omit<
        WorkoutSession,
        "id" | "createdAt" | "updatedAt"
      > = {
        clientId: uid,

        programId:
          program.id,

        programDayId:
          sessionDay.day.id,

        week:
          sessionDay.day.week,

        dayNumber:
          sessionDay.day.dayNumber,

        workoutDurationSeconds:
          DEFAULT_WORKOUT_DURATION_SECONDS,

        ariaVoiceDurationSeconds:
          DEFAULT_ARIA_VOICE_DURATION_SECONDS,

        elapsedSeconds: 0,

        ariaElapsedSeconds: 0,

        mode: "voice",

        status: "active",

        currentExerciseIndex: 0,

        currentSetNumber: 1,

        startedAt: new Date(),
      };

      const createdSessionId =
        await createWorkoutSession(
          workoutSession,
        );

      setSessionId(
        createdSessionId,
      );

      setSession({
        id: createdSessionId,
        ...workoutSession,
      });

      setElapsedSeconds(0);
      setAriaElapsedSeconds(0);
      setCurrentExerciseIndex(0);
      setCurrentSetNumber(1);
      setRestRemainingSeconds(0);
      setAriaWarningSent(false);

      setStatus("active");

      setMessage(
        "Your workout is active.",
      );
    } catch (startError) {
      console.error(
        "Failed to start workout session:",
        startError,
      );

      setStatus("error");

      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start workout.",
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * PAUSE
   * ----------------------------------------------------------
   */

  async function togglePause() {
    if (!sessionId) {
      return;
    }

    if (
      status === "active"
    ) {
      setStatus("paused");

      setMessage(
        "Workout paused.",
      );

      await updateWorkoutSession(
        sessionId,
        {
          status: "paused",
        },
      );

      return;
    }

    if (
      status === "paused"
    ) {
      setStatus("active");

      setMessage(
        "Workout resumed.",
      );

      await updateWorkoutSession(
        sessionId,
        {
          status: "active",
        },
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * COMPLETE CURRENT SET
   * ----------------------------------------------------------
   */

  async function completeCurrentSet() {
    if (
      !sessionId ||
      !currentConfig
    ) {
      return;
    }

    const isLastSet =
      currentSetNumber >=
      currentConfig.sets;

    if (isLastSet) {
      await updateWorkoutSession(
        sessionId,
        {
          currentSetNumber: 1,
        },
      );

      setCurrentSetNumber(1);

      setRestRemainingSeconds(
        currentConfig.restSeconds,
      );

      if (
        currentExerciseIndex <
        (sessionDay?.exercises
          .length ?? 1) -
          1
      ) {
        setCurrentExerciseIndex(
          (current) =>
            current + 1,
        );

        await updateWorkoutSession(
          sessionId,
          {
            currentExerciseIndex:
              currentExerciseIndex +
              1,
            currentSetNumber: 1,
          },
        );
      } else {
        setMessage(
          "Workout exercises completed. Continue until the session ends or finish the workout.",
        );
      }

      return;
    }

    const nextSet =
      currentSetNumber + 1;

    setCurrentSetNumber(
      nextSet,
    );

    setRestRemainingSeconds(
      currentConfig.restSeconds,
    );

    await updateWorkoutSession(
      sessionId,
      {
        currentSetNumber:
          nextSet,
      },
    );
  }

  /*
   * ----------------------------------------------------------
   * FINISH WORKOUT
   * ----------------------------------------------------------
   */

  async function finishWorkout() {
    if (!sessionId) {
      setStatus("complete");
      return;
    }

    try {
      await completeWorkoutSession(
        sessionId,
      );

      setStatus("complete");

      setMessage(
        "Workout complete. Great work.",
      );
    } catch (finishError) {
      console.error(
        "Failed to finish workout:",
        finishError,
      );

      setError(
        finishError instanceof Error
          ? finishError.message
          : "Unable to finish workout.",
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * CURRENT MODE
   * ----------------------------------------------------------
   */

  const visualOnly =
    session?.mode === "visual" ||
    ariaElapsedSeconds >=
      DEFAULT_ARIA_VOICE_DURATION_SECONDS;

  /*
   * ----------------------------------------------------------
   * ERROR
   * ----------------------------------------------------------
   */

  if (status === "error") {
    return (
      <div className="workout-page">
        <div className="page-title compact">
          <Link
            to="/my-program"
            className="back-link"
          >
            <ArrowLeft size={16} />
            My Program
          </Link>

          <span className="eyebrow danger">
            Workout error
          </span>

          <h1>
            We couldn't start your session.
          </h1>

          <p className="muted">
            {error}
          </p>
        </div>

        <section className="coach-console">
          <div className="aria-orb giant">
            <ShieldAlert size={58} />
          </div>

          <Link
            to="/my-program"
            className="primary-button center-button"
          >
            Back to My Program
          </Link>
        </section>
      </div>
    );
  }

  /*
   * ----------------------------------------------------------
   * COMPLETE
   * ----------------------------------------------------------
   */

  if (status === "complete") {
    return (
      <div className="workout-page">
        <div className="page-title compact">
          <Link
            to="/my-program"
            className="back-link"
          >
            <ArrowLeft size={16} />
            My Program
          </Link>

          <span className="eyebrow">
            Workout complete
          </span>

          <h1>
            Session complete.
          </h1>

          <p className="muted">
            You completed your workout.
            ARIA is proud of you.
          </p>
        </div>

        <section className="coach-console">
          <div className="aria-orb giant">
            <Check size={58} />
          </div>

          <div className="connection-state active">
            <span className="state-dot" />
            COMPLETE
          </div>

          <div
            className="context-strip"
            style={{
              justifyContent:
                "center",
            }}
          >
            <span>
              Session time
            </span>

            <strong>
              {formatTime(
                elapsedSeconds,
              )}
            </strong>
          </div>

          <Link
            to="/my-program"
            className="primary-button center-button"
          >
            Back to My Program
          </Link>
        </section>
      </div>
    );
  }

  /*
   * ----------------------------------------------------------
   * READY SCREEN
   * ----------------------------------------------------------
   */

  if (
    status === "loading" ||
    status === "ready" ||
    status === "starting"
  ) {
    return (
      <div className="workout-page">
        <div className="page-title compact">
          <Link
            to="/my-program"
            className="back-link"
          >
            <ArrowLeft size={16} />
            My Program
          </Link>

          <span className="eyebrow">
            ARIA voice coach
          </span>

          <h1>
            Put on your headphones.
          </h1>

          <p className="muted">
            {status === "loading"
              ? "Preparing your workout…"
              : status === "starting"
                ? "Starting your workout…"
                : "Your session is ready."}
          </p>
        </div>

        <section className="coach-console">
          <div className="aria-orb giant">
            <Headphones size={58} />
          </div>

          <span className="eyebrow">
            Current program
          </span>

          <h2>
            {program?.name ??
              "Preparing session"}
          </h2>

          <p>
            {sessionDay
              ? `${sessionDay.day.name} · ${sessionDay.day.focus || "Training session"}`
              : message}
          </p>

          {sessionDay && (
            <div
              className="context-strip"
              style={{
                justifyContent:
                  "center",
              }}
            >
              <span>
                Workout
              </span>

              <strong>
                30:00
              </strong>

              <span>
                ARIA voice
              </span>

              <strong>
                10:00
              </strong>
            </div>
          )}

          <div className="connection-state ready">
            <span className="state-dot" />
            READY
          </div>

          <button
            className="primary-button center-button"
            onClick={() =>
              void startSession()
            }
            disabled={
              status ===
              "loading" ||
              status ===
              "starting" ||
              !sessionDay
            }
          >
            <Play size={18} />

            {status === "starting"
              ? "Preparing…"
              : "Start with ARIA"}
          </button>

          <div className="instruction-preview">
            <div className="instruction-title">
              ARIA
            </div>

            <p>
              The workout engine is ready.
              Voice integration with{" "}
              {ARIA_MODEL} will be connected
              after the session engine is
              fully validated.
            </p>

            <p
              style={{
                opacity: 0.65,
                fontSize: "10px",
              }}
            >
              {ARIA_INSTRUCTIONS
                .replace(/\s+/g, " ")
                .slice(0, 350)}
              …
            </p>
          </div>

          <div className="safety-note">
            <ShieldAlert size={18} />

            <span>
              ARIA is a fitness coach, not
              a medical professional. Stop
              for significant pain or serious
              symptoms.
            </span>
          </div>
        </section>
      </div>
    );
  }

  /*
   * ----------------------------------------------------------
   * ACTIVE / PAUSED
   * ----------------------------------------------------------
   */

  return (
    <div className="workout-page">
      <div className="page-title compact">
        <Link
          to="/my-program"
          className="back-link"
        >
          <ArrowLeft size={16} />
          My Program
        </Link>

        <span className="eyebrow">
          {visualOnly
            ? "Visual mode"
            : "ARIA voice coach"}
        </span>

        <h1>
          {currentExercise?.exercise
            ?.name ??
            "Workout"}
        </h1>

        <p className="muted">
          {program?.name}
          {" · "}
          {sessionDay?.day.name}
        </p>
      </div>

      <section className="coach-console">
        <div className="aria-orb giant">
          {visualOnly ? (
            <Dumbbell size={58} />
          ) : (
            <Headphones size={58} />
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "10px",
            width: "100%",
            maxWidth: "520px",
          }}
        >
          <div className="stat-card">
            <Clock3 size={18} />

            <span>
              Workout remaining
            </span>

            <strong>
              {formatTime(
                workoutRemainingSeconds,
              )}
            </strong>
          </div>

          <div className="stat-card">
            <Headphones size={18} />

            <span>
              ARIA remaining
            </span>

            <strong>
              {visualOnly
                ? "VOICE ENDED"
                : formatTime(
                    ariaRemainingSeconds,
                  )}
            </strong>
          </div>
        </div>

        <div className="connection-state active">
          <span className="state-dot" />

          {visualOnly
            ? "VISUAL MODE"
            : status === "paused"
              ? "PAUSED"
              : "ARIA ACTIVE"}
        </div>

        {ariaWarningSent &&
          !visualOnly && (
            <div className="notice">
              You have 5 minutes left
              with ARIA.
            </div>
          )}

        {visualOnly && (
          <div className="notice">
            Your ARIA voice session has
            ended. Continue your workout
            visually at your own pace.
          </div>
        )}

        {currentExercise && (
          <section
            className="section-card"
            style={{
              width: "100%",
              maxWidth: "760px",
            }}
          >
            <span className="eyebrow">
              Exercise{" "}
              {currentExerciseIndex +
                1}{" "}
              of{" "}
              {sessionDay?.exercises
                .length ?? 0}
            </span>

            <h2>
              {currentExercise.exercise
                ?.name ??
                "Exercise"}
            </h2>

            <div
              className="exercise-meta"
              style={{
                marginTop: "10px",
              }}
            >
              <span>
                Set{" "}
                {currentSetNumber}{" "}
                of{" "}
                {currentConfig?.sets ??
                  0}
              </span>

              {currentConfig?.reps !==
                undefined && (
                <span>
                  {currentConfig.reps} reps
                </span>
              )}

              {currentConfig?.durationSeconds !==
                undefined && (
                <span>
                  {
                    currentConfig.durationSeconds
                  }{" "}
                  sec
                </span>
              )}

              <span>
                Rest{" "}
                {
                  currentConfig?.restSeconds ??
                  0
                }{" "}
                sec
              </span>
            </div>

            {restRemainingSeconds >
              0 && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "20px",
                  borderRadius: "18px",
                  background:
                    "#7cf7d408",
                  border:
                    "1px solid #7cf7d41a",
                  textAlign: "center",
                }}
              >
                <span className="eyebrow">
                  Rest
                </span>

                <strong
                  style={{
                    display:
                      "block",
                    fontSize: "34px",
                    marginTop:
                      "5px",
                  }}
                >
                  {formatTime(
                    restRemainingSeconds,
                  )}
                </strong>
              </div>
            )}

            <button
              type="button"
              className="primary-button"
              style={{
                width: "100%",
                marginTop:
                  "20px",
              }}
              onClick={() =>
                void completeCurrentSet()
              }
              disabled={
                status !== "active" ||
                restRemainingSeconds >
                  0
              }
            >
              <Check size={18} />

              Complete Set
            </button>
          </section>
        )}

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent:
              "center",
          }}
        >
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void togglePause()
            }
          >
            {status === "paused" ? (
              <>
                <Play size={16} />
                Resume
              </>
            ) : (
              <>
                <Pause size={16} />
                Pause
              </>
            )}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void finishWorkout()
            }
          >
            Finish Workout
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="safety-note">
          <ShieldAlert size={18} />

          <span>
            Stop the workout if you
            experience significant pain
            or serious symptoms.
          </span>
        </div>
      </section>
    </div>
  );
}