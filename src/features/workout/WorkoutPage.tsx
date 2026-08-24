import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Headphones,
  Mic2,
  Pause,
  Play,
  ShieldAlert,
} from "lucide-react";

import { Link } from "react-router-dom";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";

import {
  completeWorkoutSession,
  createWorkoutSession,
  createWorkoutSet,
  getActiveProgramForClient,
  getClientProfile,
  getProgramDayExercises,
  hasPreviousAriaSession,
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

import {
  ARIA_MODEL,
  createRealtimeSession,
} from "../../services/realtimeCoach";

import type {
  RealtimeCoachContext,
} from "../../services/realtimeCoach";

import {
  connectRealtime,
  disconnectRealtime,
  sendRealtimeFunctionResult,
} from "../../services/realtimeClient";

import type {
  RealtimeClientSession,
} from "../../services/realtimeClient";

/* ============================================================
   TYPES
   ============================================================ */

interface SessionExercise {
  programExercise: ProgramExercise;
  exercise: Exercise | null;
}

interface SessionDay {
  day: ProgramDay;
  exercises: SessionExercise[];
}

type PageStatus =
  | "loading"
  | "ready"
  | "starting"
  | "active"
  | "paused"
  | "complete"
  | "error";

type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

type PendingTransition =
  | {
      type: "next-set";
      nextSet: number;
    }
  | {
      type: "next-exercise";
      nextExerciseIndex: number;
    }
  | {
      type: "workout-ready";
    };

/* ============================================================
   TEMPORARY TEST VALUES
   ------------------------------------------------------------
   These will later come from the client's plan entitlement.
   ============================================================ */

const DEFAULT_WORKOUT_DURATION_SECONDS =
  30 * 60;

const DEFAULT_ARIA_VOICE_DURATION_SECONDS =
  10 * 60;

const ARIA_WARNING_SECONDS =
  5 * 60;

/* ============================================================
   COMPONENT
   ============================================================ */

export function WorkoutPage() {
  const { firebaseUser } = useAuth();

  /* ==========================================================
     GENERAL SESSION STATE
     ========================================================== */

  const [status, setStatus] =
    useState<PageStatus>("loading");

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState(
      "Preparing your training session…",
    );

  /* ==========================================================
     CLIENT / PROGRAM STATE
     ========================================================== */

  const [clientProfile, setClientProfile] =
    useState<ClientProfile | null>(null);

  const [program, setProgram] =
    useState<TrainingProgram | null>(null);

  const [sessionDay, setSessionDay] =
    useState<SessionDay | null>(null);

  /* ==========================================================
     WORKOUT SESSION STATE
     ========================================================== */

  const [session, setSession] =
    useState<WorkoutSession | null>(null);

  const [sessionId, setSessionId] =
    useState<string | null>(null);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [ariaElapsedSeconds, setAriaElapsedSeconds] =
    useState(0);

  const [currentExerciseIndex, setCurrentExerciseIndex] =
    useState(0);

  const [currentSetNumber, setCurrentSetNumber] =
    useState(1);

  const [restRemainingSeconds, setRestRemainingSeconds] =
    useState(0);
  const [isResting, setIsResting] =
    useState(false);

  const [pendingTransition, setPendingTransition] =
    useState<PendingTransition | null>(null);

  const [ariaWarningSent, setAriaWarningSent] =
    useState(false);

  const [ariaVoiceActive, setAriaVoiceActive] =
    useState(false);

  const [manualControlsOpen, setManualControlsOpen] =
    useState(false);

  /* ==========================================================
     REALTIME STATE
     ========================================================== */

  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("idle");

  const [realtimeError, setRealtimeError] =
    useState<string | null>(null);

  const [ariaFirstSession, setAriaFirstSession] =
    useState<boolean>(false);

  const realtimeSessionRef =
    useRef<RealtimeClientSession | null>(
      null,
    );

  /* ==========================================================
     LOAD ACTIVE PROGRAM + CLIENT PROFILE
     ========================================================== */

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
         * The real scheduler will replace
         * this later.
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

  /* ==========================================================
     CLEANUP REALTIME SESSION
     ========================================================== */

  useEffect(() => {
    return () => {
      disconnectRealtime(
        realtimeSessionRef.current,
      );

      realtimeSessionRef.current =
        null;
    };
  }, []);

  /* ==========================================================
     CURRENT EXERCISE
     ========================================================== */

  const currentExercise =
    sessionDay?.exercises[
      currentExerciseIndex
    ] ?? null;

  const currentConfig =
    currentExercise?.programExercise ??
    null;

  /*
   * ==========================================================
   * LATEST WORKOUT STATE FOR REALTIME CALLBACKS
   * ----------------------------------------------------------
   * Realtime function callbacks can outlive the React render
   * that created them. This ref always points to the latest
   * workout state so ARIA never works with stale set/exercise
   * information.
   * ==========================================================
   */

  const latestWorkoutStateRef = useRef({
    sessionId,

    currentExerciseIndex,

    currentSetNumber,

    restRemainingSeconds,

    isResting,

    currentExercise,

    currentConfig,

    sessionDay,
  });

  latestWorkoutStateRef.current = {
    sessionId,

    currentExerciseIndex,

    currentSetNumber,

    restRemainingSeconds,

    isResting,

    currentExercise,

    currentConfig,

    sessionDay,
  };

  /* ==========================================================
     TIME FORMATTER
     ========================================================== */

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

  /* ==========================================================
     REALTIME CONTEXT
     ========================================================== */

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

      currentExerciseIndex,

      totalExercises:
        sessionDay.exercises.length,

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

      ariaFirstSession,
    };
  }

  /* ==========================================================
     WORKOUT TIMER
     ========================================================== */

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

  useEffect(() => {
    if (!ariaVoiceActive) return;
    if (status !== "active") return;

    const timer =
      window.setInterval(
        () => {
          setAriaElapsedSeconds(
            (current) => {
              const next =
                Math.min(
                  current + 1,
                  DEFAULT_ARIA_VOICE_DURATION_SECONDS,
                );

              return next;
            },
          );
        },
        1000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, [ariaVoiceActive, status]);

  useEffect(() => {
    if (
      !isResting ||
      restRemainingSeconds > 0 ||
      !pendingTransition ||
      !sessionId
    ) {
      return;
    }

    const transition = pendingTransition;

    setPendingTransition(null);
    setIsResting(false);

    if (transition.type === "next-set") {
      const nextSet = transition.nextSet;

      setCurrentSetNumber(nextSet);

      void updateWorkoutSession(
        sessionId,
        {
          currentSetNumber: nextSet,
        },
      ).catch((advanceError) => {
        console.error(
          "Failed to advance to next set:",
          advanceError,
        );

        setError(
          advanceError instanceof Error
            ? advanceError.message
            : "Unable to advance to the next set.",
        );
      });

      setMessage(
        `Rest complete. Start set ${nextSet}.`,
      );

      return;
    }

    if (transition.type === "next-exercise") {
      const nextExerciseIndex =
        transition.nextExerciseIndex;

      setCurrentExerciseIndex(
        nextExerciseIndex,
      );
      setCurrentSetNumber(1);

      void updateWorkoutSession(
        sessionId,
        {
          currentExerciseIndex:
            nextExerciseIndex,
          currentSetNumber: 1,
        },
      ).catch((advanceError) => {
        console.error(
          "Failed to advance to next exercise:",
          advanceError,
        );

        setError(
          advanceError instanceof Error
            ? advanceError.message
            : "Unable to advance to the next exercise.",
        );
      });

      setMessage(
        "Rest complete. Begin the next exercise.",
      );

      return;
    }

    setMessage(
      "Rest complete. All exercises are complete. You can finish the workout.",
    );
  }, [
    isResting,
    restRemainingSeconds,
    pendingTransition,
    sessionId,
  ]);

  /* ==========================================================
     ARIA VOICE WINDOW
     ========================================================== */

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
      setAriaVoiceActive(false);

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

      /*
       * Voice session ends here.
       * Workout continues visually.
       */

      disconnectRealtime(
        realtimeSessionRef.current,
      );

      realtimeSessionRef.current =
        null;

      setRealtimeStatus(
        "disconnected",
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

  /* ==========================================================
     COMPLETE SESSION
     ========================================================== */

  useEffect(() => {
    if (
      status !== "complete" ||
      !sessionId
    ) {
      return;
    }

    disconnectRealtime(
      realtimeSessionRef.current,
    );

    realtimeSessionRef.current =
      null;

    setRealtimeStatus(
      "disconnected",
    );

    void completeWorkoutSession(
      sessionId,
    ).catch(
      (completeError) => {
        console.error(
          "Failed to complete workout session:",
          completeError,
        );
      },
    );
  }, [status, sessionId]);

  /* ==========================================================
     CONNECT ARIA REALTIME
     ========================================================== */

  async function connectAriaRealtime(
    realtimeContext: RealtimeCoachContext,
  ) {
    if (!firebaseUser) {
      throw new Error(
        "Authenticated Firebase user is unavailable.",
      );
    }

    setRealtimeStatus("connecting");
    setRealtimeError(null);

    /*
     * Solicita la credencial efímera Realtime
     * al backend seguro.
     */
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

    /*
     * Establece WebRTC y solicita
     * permisos de micrófono.
     */
    const realtimeConnection =
      await connectRealtime({
        clientSecret:
          realtimeSession.clientSecret,

        /*
         * ------------------------------------------------------
         * WEBRTC CONNECTION STATE
         * ------------------------------------------------------
         */

        onConnectionStateChange: (
          connectionState,
        ) => {
          console.info(
            "ARIA WebRTC connection:",
            connectionState,
          );

          if (
            connectionState ===
            "connected"
          ) {
            setRealtimeStatus(
              "connected",
            );

            setRealtimeError(null);

            setMessage(
              "ARIA is connected. Put on your headphones.",
            );

            return;
          }

          if (
            connectionState ===
              "disconnected" ||
            connectionState ===
              "closed" ||
            connectionState ===
              "failed"
          ) {
            setRealtimeStatus(
              "disconnected",
            );
            setAriaVoiceActive(false);
          }
        },

        /*
         * ------------------------------------------------------
         * RAW REALTIME EVENTS
         * ------------------------------------------------------
         */

        onEvent: (event) => {
          console.info(
            "ARIA Realtime event:",
            event.type,
            event,
          );

          switch (event.type) {
            case "input_audio_buffer.speech_started":
              setAriaVoiceActive(true);
              break;

            case "response.created":
              setAriaVoiceActive(true);
              break;

            case "output_audio_buffer.started":
              setAriaVoiceActive(true);
              break;

            case "output_audio_buffer.stopped":
              setAriaVoiceActive(false);
              break;

            case "response.done":
              // La respuesta lógica terminó, pero el audio puede seguir reproduciéndose.
              break;

            default:
              break;
          }
        },

        /*
         * ------------------------------------------------------
         * ARIA FUNCTION CALLS
         * ------------------------------------------------------
         *
         * This is the bridge between ARIA's voice
         * intelligence and the workout engine.
         */

        onFunctionCall: async (
          functionCall,
        ) => {
          console.info(
            "ARIA function call:",
            functionCall,
          );

          const {
            callId,
            name,
            arguments: functionArguments,
          } = functionCall;

          /*
           * ----------------------------------------------------
           * COMPLETE SET
           * ----------------------------------------------------
           */

          if (
            name ===
            "complete_set"
          ) {
            console.info(
              "ARIA requested current set completion.",
            );

            const result =
              await completeCurrentSet();

            sendRealtimeFunctionResult(
              realtimeConnection.dataChannel,
              callId,
              result,
            );

            return;
          }

          /*
           * ----------------------------------------------------
           * GET WORKOUT STATE
           * ----------------------------------------------------
           */

          if (
            name ===
            "get_workout_state"
          ) {
            try {
              const {
                currentExercise:
                  activeCurrentExercise,
                currentExerciseIndex:
                  activeCurrentExerciseIndex,
                currentSetNumber:
                  activeCurrentSetNumber,
                currentConfig:
                  activeCurrentConfig,
                sessionDay:
                  activeSessionDay,
                restRemainingSeconds:
                  activeRestRemainingSeconds,
              } = latestWorkoutStateRef.current;

              const workoutState = {
                success: true,

                exercise:
                  activeCurrentExercise
                    ?.exercise
                    ?.name ??
                  "Current exercise",

                exerciseIndex:
                  activeCurrentExerciseIndex,

                totalExercises:
                  activeSessionDay?.exercises
                    .length ??
                  0,

                currentSet:
                  activeCurrentSetNumber,

                totalSets:
                  activeCurrentConfig?.sets ??
                  0,

                targetReps:
                  activeCurrentConfig?.reps ??
                  null,

                targetDurationSeconds:
                  activeCurrentConfig
                    ?.durationSeconds ??
                  null,

                restSeconds:
                  activeCurrentConfig
                    ?.restSeconds ??
                  0,

                isResting:
                  activeRestRemainingSeconds >
                    0,

                restRemainingSeconds:
                  activeRestRemainingSeconds,

                workoutRemainingSeconds,

                ariaRemainingSeconds,
              };

              console.info(
                "ARIA requested workout state:",
                workoutState,
              );

              sendRealtimeFunctionResult(
                realtimeConnection.dataChannel,
                callId,
                workoutState,
              );
            } catch (
              functionError
            ) {
              console.error(
                "ARIA get_workout_state failed:",
                functionError,
              );

              sendRealtimeFunctionResult(
                realtimeConnection.dataChannel,
                callId,
                {
                  success: false,
                  action:
                    "get_workout_state",
                  error:
                    functionError instanceof
                    Error
                      ? functionError.message
                      : "Unable to retrieve workout state.",
                },
              );
            }

            return;
          }

          /*
           * ----------------------------------------------------
           * GET NEXT EXERCISE
           * ----------------------------------------------------
           */

          if (
            name ===
            "get_next_exercise"
          ) {
            try {
              const {
                currentExercise:
                  activeCurrentExercise,
                currentExerciseIndex:
                  activeCurrentExerciseIndex,
                sessionDay:
                  activeSessionDay,
              } = latestWorkoutStateRef.current;

              const nextExerciseIndex =
                activeCurrentExerciseIndex + 1;

              const totalExercises =
                activeSessionDay?.exercises.length ??
                0;

              /*
               * There is no next exercise.
               */
              if (
                nextExerciseIndex >=
                totalExercises
              ) {
                const result = {
                  success: true,

                  hasNextExercise: false,

                  message:
                    "There is no next exercise. The current workout is at its final exercise.",

                  currentExercise:
                    activeCurrentExercise?.exercise
                      ?.name ??
                    "Current exercise",

                  currentExerciseIndex:
                    activeCurrentExerciseIndex,

                  totalExercises,
                };

                console.info(
                  "ARIA requested next exercise:",
                  result,
                );

                sendRealtimeFunctionResult(
                  realtimeConnection.dataChannel,
                  callId,
                  result,
                );

                return;
              }

              /*
               * Get the actual next exercise
               * from the workout session.
               */
              const nextExercise =
                activeSessionDay?.exercises[
                  nextExerciseIndex
                ] ?? null;

              if (!nextExercise) {
                const result = {
                  success: false,

                  hasNextExercise: false,

                  error:
                    "The next exercise could not be found in the current workout.",
                };

                console.warn(
                  "ARIA could not find next exercise:",
                  result,
                );

                sendRealtimeFunctionResult(
                  realtimeConnection.dataChannel,
                  callId,
                  result,
                );

                return;
              }

              /*
               * The program configuration for
               * the next exercise.
               */
              const nextConfig =
                nextExercise.programExercise ??
                null;

              const result = {
                success: true,

                hasNextExercise: true,

                exercise:
                  nextExercise.exercise
                    ?.name ??
                  "Next exercise",

                exerciseIndex:
                  nextExerciseIndex,

                totalExercises,

                sets:
                  nextConfig?.sets ??
                  0,

                reps:
                  nextConfig?.reps ??
                  null,

                durationSeconds:
                  nextConfig?.durationSeconds ??
                  null,

                restSeconds:
                  nextConfig?.restSeconds ??
                  0,
              };

              console.info(
                "ARIA requested next exercise:",
                result,
              );

              sendRealtimeFunctionResult(
                realtimeConnection.dataChannel,
                callId,
                result,
              );
            } catch (
              functionError
            ) {
              console.error(
                "ARIA get_next_exercise failed:",
                functionError,
              );

              sendRealtimeFunctionResult(
                realtimeConnection.dataChannel,
                callId,
                {
                  success: false,

                  hasNextExercise: false,

                  error:
                    functionError instanceof
                    Error
                      ? functionError.message
                      : "Unable to retrieve the next exercise.",
                },
              );
            }

            return;
          }

          /*
           * ----------------------------------------------------
           * SKIP REST
           * ----------------------------------------------------
           */

          if (
            name ===
            "skip_rest"
          ) {
            console.info(
              "ARIA requested rest to be skipped.",
            );

            /*
             * There is no active rest period.
             */
            if (
              !isResting ||
              !pendingTransition
            ) {
              const result = {
                success: false,

                skipped: false,

                reason:
                  "There is no active rest period to skip.",
              };

              console.info(
                "ARIA skip_rest ignored:",
                result,
              );

              sendRealtimeFunctionResult(
                realtimeConnection.dataChannel,
                callId,
                result,
              );

              return;
            }

            /*
             * Keep the pending transition intact.
             *
             * Setting the remaining rest time to zero
             * allows the existing workout transition
             * effect to advance the workout normally.
             */
            setRestRemainingSeconds(0);

            setMessage(
              "Rest skipped. Continuing workout.",
            );

            const result = {
              success: true,

              skipped: true,

              message:
                "The rest period was skipped. Continue with the pending workout transition.",
            };

            console.info(
              "ARIA rest skipped:",
              result,
            );

            sendRealtimeFunctionResult(
              realtimeConnection.dataChannel,
              callId,
              result,
            );

            return;
          }

          /*
           * ----------------------------------------------------
           * UNKNOWN FUNCTION
           * ----------------------------------------------------
           */

          console.warn(
            "ARIA requested an unknown function:",
            name,
            functionArguments,
          );

          sendRealtimeFunctionResult(
            realtimeConnection.dataChannel,
            callId,
            {
              success: false,
              error:
                `Unknown ARIA function: ${name}`,
            },
          );
        },
      });

    realtimeSessionRef.current =
      realtimeConnection;

    setRealtimeStatus(
      "connected",
    );
  }

  /* ==========================================================
     START WORKOUT + ARIA
     ========================================================== */

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

    /*
     * Reset temporary voice state.
     */

    setRealtimeStatus(
      "connecting",
    );

    setRealtimeError(null);

    setStatus("starting");

    setMessage(
      "Preparing your ARIA voice session…",
    );

    try {
      /*
       * 1. Check if client has used ARIA before.
       */

      const hasUsedAria =
        await hasPreviousAriaSession(
          uid,
        );

      const isFirstAriaSession =
        !hasUsedAria;

      setAriaFirstSession(
        isFirstAriaSession,
      );

      console.info(
        "ARIA first session:",
        isFirstAriaSession,
      );

      /*
       * 2. Create persistent workout session.
       */

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

      setIsResting(false);
      setPendingTransition(null);

      setAriaWarningSent(
        false,
      );

      setManualControlsOpen(
        false,
      );

      /*
       * 3. Build trusted session context.
       *
       * At session start we explicitly use the
       * known initial timer values rather than relying
       * on React state updates having completed.
       */

     const realtimeContext:
  RealtimeCoachContext = {
  preferredLanguage:
    clientProfile?.preferredLanguage ??
    "auto",

  clientName:
    clientProfile?.displayName ??
    firebaseUser.displayName ??
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

  currentExerciseIndex,

  totalExercises:
    sessionDay.exercises.length,

  currentSet: 1,

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

  ariaRemainingSeconds:
    DEFAULT_ARIA_VOICE_DURATION_SECONDS,

  workoutRemainingSeconds:
    DEFAULT_WORKOUT_DURATION_SECONDS,

  mode: "voice",

  ariaFirstSession:
    isFirstAriaSession,
};

      console.info(
        "ARIA realtime context:",
        realtimeContext,
      );

      /*
       * 3. Authenticate + connect Realtime.
       *
       * connectRealtime() will request microphone
       * permission at this point.
       */

      setStatus("active");

      setMessage(
        "Connecting ARIA…",
      );

      try {
        await connectAriaRealtime(
          realtimeContext,
        );
      } catch (
        realtimeErrorValue
      ) {
        console.error(
          "ARIA voice connection failed:",
          realtimeErrorValue,
        );

        setRealtimeStatus(
          "error",
        );

        const friendlyMessage =
          realtimeErrorValue instanceof
          DOMException
            ? realtimeErrorValue.name ===
              "NotAllowedError"
              ? "Microphone permission was denied. You can continue using visual mode."
              : realtimeErrorValue.message
            : realtimeErrorValue instanceof
                Error
              ? realtimeErrorValue.message
              : "ARIA voice connection could not be established.";

        setRealtimeError(
          friendlyMessage,
        );

        /*
         * The workout session remains active.
         * This is intentional: the user can still
         * continue visually or retry later.
         */

        setMessage(
          "Workout active. ARIA voice could not connect.",
        );
      }
    } catch (
      startError
    ) {
      console.error(
        "Failed to start workout session:",
        startError,
      );

      disconnectRealtime(
        realtimeSessionRef.current,
      );

      realtimeSessionRef.current =
        null;

      setRealtimeStatus(
        "error",
      );

      setStatus("error");

      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start workout.",
      );
    }
  }

  /* ==========================================================
     PAUSE / RESUME
     ========================================================== */

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

  /* ==========================================================
     COMPLETE CURRENT SET
     ----------------------------------------------------------
     Manual fallback for now.
     GPT function calls will eventually call the
     same session-state logic.
     ========================================================== */

  async function completeCurrentSet() {
    const {
      sessionId: activeSessionId,
      currentExerciseIndex:
        activeCurrentExerciseIndex,
      currentSetNumber:
        activeCurrentSetNumber,
      isResting: activeIsResting,
      currentExercise:
        activeCurrentExercise,
      currentConfig:
        activeCurrentConfig,
      sessionDay:
        activeSessionDay,
    } = latestWorkoutStateRef.current;

    if (
      !activeSessionId ||
      !activeCurrentConfig ||
      !activeCurrentExercise?.exercise ||
      activeIsResting
    ) {
      return {
        success: false,
        reason: activeIsResting
          ? "The workout is currently resting."
          : "The current workout state is unavailable.",
      };
    }

    const exerciseId =
      activeCurrentExercise.exercise.id;

    const exerciseName =
      activeCurrentExercise.exercise.name ??
      "Current exercise";

    const completedSetNumber =
      activeCurrentSetNumber;

    const completedAt =
      new Date();

    try {
      /*
       * 1. Register the completed set
       * in Firestore BEFORE advancing.
       */
      await createWorkoutSet(
        activeSessionId,
        {
          exerciseId,

          setNumber:
            activeCurrentSetNumber,

          targetReps:
            activeCurrentConfig.reps,

          targetDurationSeconds:
            activeCurrentConfig.durationSeconds,

          /*
           * First MVP:
           * actual values use the target values.
           *
           * Later ARIA/manual input will provide
           * the real performed values.
           */
          actualReps:
            activeCurrentConfig.reps,

          actualDurationSeconds:
            activeCurrentConfig.durationSeconds,

          completed: true,

          completedAt,
        },
      );

      console.info(
        "Workout set recorded:",
        {
          sessionId: activeSessionId,
          exerciseId,
          setNumber:
            activeCurrentSetNumber,
        },
      );

      /*
       * 2. Determine whether this was
       * the final set of the exercise.
       */
      const isLastSet =
        activeCurrentSetNumber >=
        activeCurrentConfig.sets;

      const restSeconds =
        activeCurrentConfig.restSeconds;

      /*
       * 3. Final set of current exercise.
       */
      if (isLastSet) {
        const isLastExercise =
          activeCurrentExerciseIndex >=
          (activeSessionDay?.exercises.length ??
            1) -
            1;

        /*
         * ------------------------------------------------------
         * Final set but there is another exercise.
         * ------------------------------------------------------
         */
        if (!isLastExercise) {
          const nextExerciseIndex =
            activeCurrentExerciseIndex + 1;

          if (restSeconds > 0) {
            setRestRemainingSeconds(
              restSeconds,
            );

            setPendingTransition({
              type: "next-exercise",
              nextExerciseIndex,
            });

            setIsResting(true);

            setMessage(
              `Exercise complete. Rest for ${restSeconds} seconds.`,
            );

            return {
              success: true,

              action:
                "complete_set",

              completedSet:
                completedSetNumber,

              completedExercise:
                exerciseName,

              isLastSet: true,

              isLastExercise: false,

              transition:
                "next-exercise",

              nextExerciseIndex,

              restSeconds,
            };
          }

          setCurrentExerciseIndex(
            nextExerciseIndex,
          );

          setCurrentSetNumber(1);

          await updateWorkoutSession(
            activeSessionId,
            {
              currentExerciseIndex:
                nextExerciseIndex,

              currentSetNumber: 1,
            },
          );

          setMessage(
            "Exercise complete. Begin the next exercise.",
          );

          return {
            success: true,

            action:
              "complete_set",

            completedSet:
              completedSetNumber,

            completedExercise:
              exerciseName,

            isLastSet: true,

            isLastExercise: false,

            transition:
              "next-exercise",

            nextExerciseIndex,

            restSeconds: 0,
          };
        }

        /*
         * ------------------------------------------------------
         * Final set of final exercise.
         * ------------------------------------------------------
         */
        if (restSeconds > 0) {
          setRestRemainingSeconds(
            restSeconds,
          );

          setPendingTransition({
            type: "workout-ready",
          });

          setIsResting(true);

          setMessage(
            `Final set complete. Rest for ${restSeconds} seconds.`,
          );

          return {
            success: true,

            action:
              "complete_set",

            completedSet:
              completedSetNumber,

            completedExercise:
              exerciseName,

            isLastSet: true,

            isLastExercise: true,

            transition:
              "workout-ready",

            restSeconds,
          };
        }

        setMessage(
          "All exercises are complete. You can finish the workout.",
        );

        return {
          success: true,

          action:
            "complete_set",

          completedSet:
            completedSetNumber,

          completedExercise:
            exerciseName,

          isLastSet: true,

          isLastExercise: true,

          transition:
            "workout-complete",

          restSeconds: 0,
        };
      }

      /*
       * --------------------------------------------------------
       * There are more sets in the current exercise.
       * --------------------------------------------------------
       */

      const nextSet =
        activeCurrentSetNumber + 1;

      if (restSeconds > 0) {
        setRestRemainingSeconds(
          restSeconds,
        );

        setPendingTransition({
          type: "next-set",
          nextSet,
        });

        setIsResting(true);

        setMessage(
          `Set complete. Rest for ${restSeconds} seconds.`,
        );

        return {
          success: true,

          action:
            "complete_set",

          completedSet:
            completedSetNumber,

          completedExercise:
            exerciseName,

          isLastSet: false,

          isLastExercise: false,

          transition:
            "next-set",

          nextSet,

          restSeconds,
        };
      }

      setCurrentSetNumber(
        nextSet,
      );

      await updateWorkoutSession(
        activeSessionId,
        {
          currentSetNumber:
            nextSet,
        },
      );

      setMessage(
        `Set complete. Starting set ${nextSet}.`,
      );

      return {
        success: true,

        action:
          "complete_set",

        completedSet:
          completedSetNumber,

        completedExercise:
          exerciseName,

        isLastSet: false,

        isLastExercise: false,

        transition:
          "next-set",

        nextSet,

        restSeconds: 0,
      };
    } catch (recordError) {
      console.error(
        "Failed to record workout set:",
        recordError,
      );

      const errorMessage =
        recordError instanceof Error
          ? recordError.message
          : "Unable to record the completed set.";

      setError(
        errorMessage,
      );

      return {
        success: false,

        action:
          "complete_set",

        error:
          errorMessage,
      };
    }
  }

  /* ==========================================================
     FINISH WORKOUT
     ========================================================== */

  async function finishWorkout() {
    disconnectRealtime(
      realtimeSessionRef.current,
    );

    realtimeSessionRef.current =
      null;

    setRealtimeStatus(
      "disconnected",
    );

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

  /* ==========================================================
     ERROR SCREEN
     ========================================================== */

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

  /* ==========================================================
     COMPLETE SCREEN
     ========================================================== */

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
            You completed your
            workout. ARIA is proud
            of you.
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

  /* ==========================================================
     READY SCREEN
     ========================================================== */

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
            Put on your
            headphones.
          </h1>

          <p className="muted">
            {status === "loading"
              ? "Preparing your workout…"
              : status ===
                  "starting"
                ? "Preparing ARIA and your microphone…"
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

          <div
            className={`connection-state ${
              realtimeStatus ===
              "error"
                ? "danger"
                : "ready"
            }`}
          >
            <span className="state-dot" />

            {realtimeStatus ===
            "error"
              ? "VOICE NOT READY"
              : "READY"}
          </div>

          <button
            type="button"
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
            <Mic2
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
              Put on your headphones
              and allow microphone
              access when prompted.
              After that, ARIA will
              coach the session
              hands-free.
            </p>

            <p
              style={{
                opacity: 0.65,
                fontSize: "10px",
              }}
            >
              Model:{" "}
              {ARIA_MODEL}
            </p>

            {realtimeError && (
              <p
                style={{
                  marginTop:
                    "10px",
                  color:
                    "#ff9b9b",
                  fontSize:
                    "11px",
                }}
              >
                {realtimeError}
              </p>
            )}
          </div>

          <div className="safety-note">
            <ShieldAlert
              size={18}
            />

            <span>
              ARIA is a fitness
              coach, not a medical
              professional. Stop for
              significant pain or
              serious symptoms.
            </span>
          </div>
        </section>
      </div>
    );
  }

  /* ==========================================================
     ACTIVE / PAUSED
     ========================================================== */

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
          {currentExercise
            ?.exercise?.name ??
            "Workout"}
        </h1>

        <p className="muted">
          {program?.name}
          {" · "}
          {sessionDay?.day.name}
        </p>
      </div>

      <section className="coach-console">
       <div
  className={`aria-orb giant ${
    realtimeStatus === "connected"
      ? "voice-active"
      : ""
  }`}
>
  {visualMode ? (
    <Dumbbell size={58} />
  ) : (
    <Headphones size={58} />
  )}
</div>

        {/* =====================================================
            REALTIME STATE
            ===================================================== */}

        <div
          className={`connection-state ${
            realtimeStatus ===
            "connected"
              ? "active"
              : realtimeStatus ===
                    "error"
                ? "danger"
                : "ready"
          }`}
        >
          <span className="state-dot" />

          {visualMode
            ? "VISUAL MODE"
            : realtimeStatus ===
                "connected"
              ? "ARIA CONNECTED"
              : realtimeStatus ===
                    "connecting"
                ? "CONNECTING ARIA"
                : status ===
                      "paused"
                  ? "PAUSED"
                  : "ARIA ACTIVE"}
        </div>

        {/* =====================================================
            TIMERS
            ===================================================== */}

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
              Workout
              remaining
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

        {/* =====================================================
            WARNINGS / MESSAGES
            ===================================================== */}

        {realtimeStatus ===
          "connected" &&
          voiceMode && (
            <div
              className="notice"
              style={{
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                gap: "8px",
              }}
            >
              <Mic2
                size={15}
              />
              ARIA is listening.
              Keep your phone down
              and train.
            </div>
          )}

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

        {realtimeError && (
          <div
            className="notice"
            style={{
              color:
                "#ffb1b1",
            }}
          >
            {realtimeError}
          </div>
        )}

        {/* =====================================================
            CURRENT EXERCISE
            ===================================================== */}

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
              {currentExercise
                .exercise?.name ??
                "Exercise"}
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

              {currentConfig
                ?.reps !==
                undefined && (
                <span>
                  {
                    currentConfig.reps
                  }{" "}
                  reps
                </span>
              )}

              {currentConfig
                ?.durationSeconds !==
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

            {/* =================================================
                VOICE MODE
                ================================================= */}

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
                  {realtimeStatus ===
                  "connected"
                    ? "ARIA is coaching you"
                    : "ARIA voice is unavailable"}
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
                  {realtimeStatus ===
                  "connected"
                    ? "Keep training. You do not need to watch the phone."
                    : "You can continue using the manual controls while we troubleshoot voice."}
                </span>
              </div>
            )}

            {/* =================================================
                VISUAL MODE
                ================================================= */}

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
                  isResting ||
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

        {/* =====================================================
            MANUAL FALLBACK CONTROLS
            ===================================================== */}

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

        {/* =====================================================
            SAFETY
            ===================================================== */}

        <div className="safety-note">
          <ShieldAlert
            size={18}
          />

          <span>
            Stop the workout if you
            experience significant
            pain or serious symptoms.
          </span>
        </div>
      </section>
    </div>
  );
}