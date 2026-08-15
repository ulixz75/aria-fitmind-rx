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

import {
  useEffect,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";

import {
  completeWorkoutSession,
  createWorkoutSession,
  getActiveProgramForClient,
  getClientProfile,
  getProgramDayExercises,
  listProgramDays,
  updateWorkoutSession,
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

import type {
  ClientProfile,
} from "../../types/models";

import type {
  RealtimeCoachContext,
} from "../../services/realtimeCoach";

import {
  ARIA_MODEL,
  createRealtimeSession,
} from "../../services/realtimeCoach";

interface SessionExercise {
  programExercise: ProgramExercise;
  exercise: Exercise | null;
}

interface SessionDay {
  day: ProgramDay;
  exercises: SessionExercise[];
}

const DEFAULT_WORKOUT_DURATION_SECONDS =
  30 * 60;

const DEFAULT_ARIA_VOICE_DURATION_SECONDS =
  10 * 60;

const ARIA_WARNING_SECONDS =
  5 * 60;

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
    useState<PageStatus>(
      "loading",
    );

  const [clientProfile, setClientProfile] =
    useState<ClientProfile | null>(
      null,
    );

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
    useState<string | null>(
      null,
    );

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [ariaElapsedSeconds, setAriaElapsedSeconds] =
    useState(0);

  const [
    currentExerciseIndex,
    setCurrentExerciseIndex,
  ] = useState(0);

  const [
    currentSetNumber,
    setCurrentSetNumber,
  ] = useState(1);

  const [
    restRemainingSeconds,
    setRestRemainingSeconds,
  ] = useState(0);

  const [
    ariaWarningSent,
    setAriaWarningSent,
  ] = useState(false);

  const [
    manualControlsOpen,
    setManualControlsOpen,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  /*
   * ==========================================================
   * LOAD ACTIVE PROGRAM + CLIENT PROFILE
   * ==========================================================
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

    async function loadWorkout(
      clientId: string,
    ) {
      setStatus("loading");
      setError(null);

      try {
        const [
          activeProgram,
          loadedClientProfile,
        ] = await Promise.all([
          getActiveProgramForClient(
            clientId,
          ),
          getClientProfile(
            clientId,
          ),
        ]);

        if (!cancelled) {
          setClientProfile(
            loadedClientProfile,
          );
        }

        if (
          !activeProgram?.program
        ) {
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
         * The session scheduler will replace this later.
         */

        const selectedDay =
          days[0];

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
            exercises:
              exerciseViews,
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
   * ==========================================================
   * CURRENT EXERCISE
   * ==========================================================
   */

  const currentExercise =
    sessionDay?.exercises[
      currentExerciseIndex
    ] ?? null;

  const currentConfig =
    currentExercise?.programExercise ??
    null;

  /*
   * ==========================================================
   * FORMATTER
   * ==========================================================
   */

  function formatTime(
    seconds: number,
  ) {
    const safeSeconds =
      Math.max(
        0,
        Math.floor(seconds),
      );

    const minutes =
      Math.floor(
        safeSeconds / 60,
      );

    const remaining =
      safeSeconds % 60;

    return `${String(
      minutes,
    ).padStart(
      2,
      "0",
    )}:${String(
      remaining,
    ).padStart(
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

  const voiceMode =
    status === "active" &&
    session?.mode !== "visual";

  const visualMode =
    session?.mode === "visual" ||
    ariaElapsedSeconds >=
      DEFAULT_ARIA_VOICE_DURATION_SECONDS;

  /*
   * ==========================================================
   * REALTIME CONTEXT
   * ==========================================================
   */

  function buildRealtimeContext():
    RealtimeCoachContext | null {
    if (
      !program ||
      !sessionDay ||
      !currentExercise
    ) {
      return null;
    }

    return {
      preferredLanguage:
        clientProfile?.preferredLanguage ??
        "auto",

      clientName:
        clientProfile?.displayName ??
        firebaseUser?.displayName ??
        "Client",

      fitnessLevel:
        clientProfile?.fitnessLevel,

      primaryGoals:
        clientProfile?.primaryGoals ??
        [],

      programName:
        program.name,

      dayName:
        sessionDay.day.name,

      currentExercise:
        currentExercise.exercise
          ?.name ??
        "Current exercise",

      currentSet:
        currentSetNumber,

      totalSets:
        currentConfig?.sets ??
        0,

      targetReps:
        currentConfig?.reps,

      targetDurationSeconds:
        currentConfig?.durationSeconds,

      restSeconds:
        currentConfig?.restSeconds ??
        0,

      ariaRemainingSeconds,

      workoutRemainingSeconds,

      mode:
        visualMode
          ? "visual"
          : "voice",
    };
  }

  /*
   * ==========================================================
   * WORKOUT TIMER
   * ==========================================================
   */

  useEffect(() => {
    if (
      status !== "active"
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setElapsedSeconds(
            (current) => {
              const next =
                current + 1;

              if (
                next >=
                DEFAULT_WORKOUT_DURATION_SECONDS
              ) {
                setStatus(
                  "complete",
                );

                return DEFAULT_WORKOUT_DURATION_SECONDS;
              }

              return next;
            },
          );

          setAriaElapsedSeconds(
            (current) => {
              const next =
                current + 1;

              return Math.min(
                next,
                DEFAULT_ARIA_VOICE_DURATION_SECONDS,
              );
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
      window.clearInterval(
        timer,
      );
  }, [status]);

  /*
   * ==========================================================
   * ARIA VOICE WINDOW
   * ==========================================================
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
      setAriaWarningSent(
        true,
      );

      /*
       * GPT Realtime will later receive
       * this event and speak the 5-minute warning.
       */

      console.info(
        "ARIA 5-minute warning threshold reached.",
      );
    }

    if (
      ariaElapsedSeconds >=
        DEFAULT_ARIA_VOICE_DURATION_SECONDS &&
      session?.mode !== "visual" &&
      sessionId
    ) {
      setSession(
        (current) =>
          current
            ? {
                ...current,
                mode: "visual",
                ariaElapsedSeconds:
                  DEFAULT_ARIA_VOICE_DURATION_SECONDS,
              }
            : current,
      );

      void updateWorkoutSession(
        sessionId,
        {
          mode: "visual",
          ariaElapsedSeconds:
            DEFAULT_ARIA_VOICE_DURATION_SECONDS,
        },
      ).catch(
        (voiceError) => {
          console.error(
            "Failed to save ARIA visual-mode transition:",
            voiceError,
          );
        },
      );
    }
  }, [
    status,
    ariaElapsedSeconds,
    ariaWarningThresholdReached,
    ariaWarningSent,
    session,
    sessionId,
  ]);

  /*
   * ==========================================================
   * COMPLETE SESSION
   * ==========================================================
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
    ).catch(
      (
        completeError,
      ) => {
        console.error(
          "Failed to complete workout session:",
          completeError,
        );
      },
    );
  }, [
    status,
    sessionId,
  ]);

  /*
   * ==========================================================
   * START SESSION
   * ==========================================================
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

        startedAt:
          new Date(),
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

      setAriaElapsedSeconds(
        0,
      );

      setCurrentExerciseIndex(
        0,
      );

      setCurrentSetNumber(
        1,
      );

      setRestRemainingSeconds(
        0,
      );

      setAriaWarningSent(
        false,
      );

      setManualControlsOpen(
        false,
      );

      setStatus("active");

      setMessage(
        "Your workout is active.",
      );

      /*
       * Build the exact context that will later
       * be sent to the secure Realtime endpoint.
       *
       * We intentionally do not call OpenAI yet.
       */

      const realtimeContext =
  buildRealtimeContext();

if (!realtimeContext) {
  throw new Error(
    "Unable to build ARIA realtime context.",
  );
}

try {
  const realtimeSession =
    await createRealtimeSession(
      firebaseUser,
      realtimeContext,
    );

  console.info(
    "ARIA Realtime secure session created.",
    {
      expiresAt:
        realtimeSession.expiresAt,
    },
  );
} catch (realtimeError) {
  console.error(
    "ARIA Realtime session creation failed:",
    realtimeError,
  );

  setMessage(
    realtimeError instanceof Error
      ? realtimeError.message
      : "ARIA voice session could not be prepared.",
  );
}
    } catch (
      startError
    ) {
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
   * ==========================================================
   * PAUSE / RESUME
   * ==========================================================
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
   * ==========================================================
   * COMPLETE SET
   * ==========================================================
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
      setRestRemainingSeconds(
        currentConfig.restSeconds,
      );

      if (
        currentExerciseIndex <
        (sessionDay?.exercises
          .length ??
          1) -
          1
      ) {
        const nextExerciseIndex =
          currentExerciseIndex +
          1;

        setCurrentExerciseIndex(
          nextExerciseIndex,
        );

        setCurrentSetNumber(
          1,
        );

        await updateWorkoutSession(
          sessionId,
          {
            currentExerciseIndex:
              nextExerciseIndex,

            currentSetNumber:
              1,
          },
        );

        return;
      }

      setMessage(
        "All exercises are complete. Continue until the workout ends or finish the session.",
      );

      return;
    }

    const nextSet =
      currentSetNumber +
      1;

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
   * ==========================================================
   * FINISH WORKOUT
   * ==========================================================
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
    } catch (
      finishError
    ) {
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
   * ==========================================================
   * ERROR SCREEN
   * ==========================================================
   */

  if (
    status === "error"
  ) {
    return (
      <div className="workout-page">
        <div className="page-title compact">
          <Link
            to="/my-program"
            className="back-link"
          >
            <ArrowLeft
              size={16}
            />
            My Program
          </Link>

          <span className="eyebrow danger">
            Workout error
          </span>

          <h1>
            We couldn't start
            your session.
          </h1>

          <p className="muted">
            {error}
          </p>
        </div>

        <section className="coach-console">
          <div className="aria-orb giant">
            <ShieldAlert
              size={58}
            />
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
   * ==========================================================
   * COMPLETE SCREEN
   * ==========================================================
   */

  if (
    status === "complete"
  ) {
    return (
      <div className="workout-page">
        <div className="page-title compact">
          <Link
            to="/my-program"
            className="back-link"
          >
            <ArrowLeft
              size={16}
            />
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
            <Check
              size={58}
            />
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
   * ==========================================================
   * READY SCREEN
   * ==========================================================
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
            <ArrowLeft
              size={16}
            />
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
              : status ===
                  "starting"
                ? "Starting your workout…"
                : "Your session is ready."}
          </p>
        </div>

        <section className="coach-console">
          <div className="aria-orb giant">
            <Headphones
              size={58}
            />
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
              ? `${sessionDay.day.name} · ${
                  sessionDay.day.focus ||
                  "Training session"
                }`
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
            <Play
              size={18}
            />

            {status ===
            "starting"
              ? "Preparing…"
              : "Start with ARIA"}
          </button>

          <div className="instruction-preview">
            <div className="instruction-title">
              ARIA
            </div>

            <p>
              Your voice coach will
              guide the session while
              you train hands-free.
            </p>

            <p
              style={{
                opacity: 0.65,
                fontSize: "10px",
              }}
            >
              Model: {ARIA_MODEL}
              <br />
              Your personalized coaching
              instructions will be applied
              when ARIA voice coaching
              starts.
            </p>
          </div>

          <div className="safety-note">
            <ShieldAlert
              size={18}
            />

            <span>
              ARIA is a fitness coach,
              not a medical professional.
              Stop for significant pain
              or serious symptoms.
            </span>
          </div>
        </section>
      </div>
    );
  }

  /*
   * ==========================================================
   * ACTIVE / PAUSED
   * ==========================================================
   */

  return (
    <div className="workout-page">
      <div className="page-title compact">
        <Link
          to="/my-program"
          className="back-link"
        >
          <ArrowLeft
            size={16}
          />
          My Program
        </Link>

        <span className="eyebrow">
          {visualMode
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
          {visualMode ? (
            <Dumbbell
              size={58}
            />
          ) : (
            <Headphones
              size={58}
            />
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "10px",
            width: "100%",
            maxWidth: "560px",
          }}
        >
          <div className="stat-card">
            <Clock3
              size={18}
            />

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
            <Headphones
              size={18}
            />

            <span>
              ARIA remaining
            </span>

            <strong>
              {visualMode
                ? "VOICE ENDED"
                : formatTime(
                    ariaRemainingSeconds,
                  )}
            </strong>
          </div>
        </div>

        <div
          className={`connection-state ${
            visualMode
              ? "ready"
              : "active"
          }`}
        >
          <span className="state-dot" />

          {visualMode
            ? "VISUAL MODE"
            : status === "paused"
              ? "PAUSED"
              : "ARIA ACTIVE"}
        </div>

        {ariaWarningSent &&
          !visualMode && (
            <div className="notice">
              ARIA has 5 minutes
              remaining.
            </div>
          )}

        {visualMode && (
          <div className="notice">
            Your ARIA voice session
            has ended. Continue your
            workout visually at your
            own pace.
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
              {
                sessionDay
                  ?.exercises
                  .length
              }
            </span>

            <h2>
              {
                currentExercise
                  .exercise
                  ?.name ??
                "Exercise"
              }
            </h2>

            <div
              className="exercise-meta"
              style={{
                marginTop:
                  "10px",
              }}
            >
              <span>
                Set{" "}
                {currentSetNumber}{" "}
                of{" "}
                {
                  currentConfig
                    ?.sets ??
                  0
                }
              </span>

              {currentConfig?.reps !==
                undefined && (
                <span>
                  {
                    currentConfig.reps
                  }{" "}
                  reps
                </span>
              )}

              {currentConfig?.durationSeconds !==
                undefined && (
                <span>
                  {
                    currentConfig
                      .durationSeconds
                  }{" "}
                  sec
                </span>
              )}

              <span>
                Rest{" "}
                {
                  currentConfig
                    ?.restSeconds ??
                  0
                }{" "}
                sec
              </span>
            </div>

            {restRemainingSeconds >
              0 && (
              <div
                style={{
                  marginTop:
                    "18px",
                  padding:
                    "20px",
                  borderRadius:
                    "18px",
                  background:
                    "#7cf7d408",
                  border:
                    "1px solid #7cf7d41a",
                  textAlign:
                    "center",
                }}
              >
                <span className="eyebrow">
                  Rest
                </span>

                <strong
                  style={{
                    display:
                      "block",
                    fontSize:
                      "34px",
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

            {voiceMode && (
              <div
                style={{
                  marginTop:
                    "20px",
                  padding:
                    "16px",
                  borderRadius:
                    "16px",
                  background:
                    "#7cf7d406",
                  border:
                    "1px solid #7cf7d414",
                  textAlign:
                    "center",
                }}
              >
                <Headphones
                  size={20}
                />

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      "7px",
                    fontSize:
                      "13px",
                  }}
                >
                  ARIA is coaching
                  you
                </strong>

                <span
                  style={{
                    display:
                      "block",
                    marginTop:
                      "5px",
                    color:
                      "#8e9aaa",
                    fontSize:
                      "11px",
                  }}
                >
                  Keep training. Your
                  voice coach will handle
                  the session flow.
                </span>
              </div>
            )}

            {visualMode && (
              <button
                type="button"
                className="primary-button"
                style={{
                  width:
                    "100%",
                  marginTop:
                    "20px",
                }}
                onClick={() =>
                  void completeCurrentSet()
                }
                disabled={
                  status !==
                    "active" ||
                  restRemainingSeconds >
                    0
                }
              >
                <Check
                  size={18}
                />

                Complete Set
              </button>
            )}
          </section>
        )}

        <div
          style={{
            width: "100%",
            maxWidth: "560px",
          }}
        >
          <button
            type="button"
            className="secondary-button"
            style={{
              width: "100%",
              justifyContent:
                "center",
            }}
            onClick={() =>
              setManualControlsOpen(
                (current) =>
                  !current,
              )
            }
          >
            {manualControlsOpen
              ? "Hide manual controls"
              : "Manual controls"}
          </button>

          {manualControlsOpen && (
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "center",
                gap: "10px",
                flexWrap:
                  "wrap",
                marginTop:
                  "10px",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void togglePause()
                }
              >
                {status ===
                "paused" ? (
                  <>
                    <Play
                      size={16}
                    />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause
                      size={16}
                    />
                    Pause
                  </>
                )}
              </button>

              {voiceMode && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    void completeCurrentSet()
                  }
                  disabled={
                    status !==
                      "active" ||
                    restRemainingSeconds >
                      0
                  }
                >
                  <Check
                    size={16}
                  />
                  Mark Set
                  Complete
                </button>
              )}

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void finishWorkout()
                }
              >
                Finish Workout
                <ChevronRight
                  size={16}
                />
              </button>
            </div>
          )}
        </div>

        <div className="safety-note">
          <ShieldAlert
            size={18}
          />

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