import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Dumbbell,
} from "lucide-react";
import {
  Link,
  useParams,
} from "react-router-dom";

import {
  getExercise,
  resolveStorageUrl,
} from "../../services/firestore";

import type { Exercise } from "../../types/exercises";

/* ============================================================
   SHARED VIEW TYPE
   ============================================================ */

export type ExerciseDetailView =
  Exercise & {
    previewUrl: string | null;
    animationUrl: string | null;
  };

/* ============================================================
   REUSABLE PRESENTATIONAL DETAIL
   Used by both:
   - Modal in MyProgramPage
   - Standalone route /exercises/:id
   ============================================================ */

export function ExerciseDetailContent({
  exercise,
}: {
  exercise: ExerciseDetailView;
}) {
  return (
    <>
      <div className="exercise-detail-media">
        {exercise.animationUrl ? (
          <img
            src={exercise.animationUrl}
            alt={exercise.name}
          />
        ) : exercise.previewUrl ? (
          <img
            src={exercise.previewUrl}
            alt={exercise.name}
          />
        ) : (
          <div className="exercise-placeholder">
            <Dumbbell size={40} />
            <span>
              No preview available
            </span>
          </div>
        )}
      </div>

      <div className="exercise-detail">
        <span className="eyebrow">
          {exercise.category}
        </span>

        <h2>{exercise.name}</h2>

        <p className="muted">
          {exercise.description}
        </p>

        <div className="exercise-detail-grid">
          <div>
            <strong>Difficulty</strong>
            <span>
              {exercise.difficulty}
            </span>
          </div>

          <div>
            <strong>Body part</strong>
            <span>
              {exercise.bodyPart}
            </span>
          </div>

          <div>
            <strong>Equipment</strong>
            <span>
              {exercise.equipment.length > 0
                ? exercise.equipment.join(", ")
                : "None"}
            </span>
          </div>

          <div>
            <strong>Mechanic</strong>
            <span>{exercise.mechanic}</span>
          </div>
        </div>

        {exercise.primaryMuscles.length > 0 && (
          <div className="exercise-detail-section">
            <h3>Primary muscles</h3>

            <div className="tag-list">
              {exercise.primaryMuscles.map(
                (muscle) => (
                  <span key={muscle}>
                    {muscle}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {exercise.secondaryMuscles.length > 0 && (
          <div className="exercise-detail-section">
            <h3>Secondary muscles</h3>

            <div className="tag-list">
              {exercise.secondaryMuscles.map(
                (muscle) => (
                  <span key={muscle}>
                    {muscle}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {exercise.goals.length > 0 && (
          <div className="exercise-detail-section">
            <h3>Goals</h3>

            <div className="tag-list">
              {exercise.goals.map((goal) => (
                <span key={goal}>
                  {goal}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="exercise-detail-section">
          <h3>Instructions</h3>

          <ol>
            {exercise.instructions.map(
              (instruction, index) => (
                <li
                  key={`${exercise.id}-instruction-${index}`}
                >
                  {instruction}
                </li>
              ),
            )}
          </ol>
        </div>

        {exercise.tips.length > 0 && (
          <div className="exercise-detail-section">
            <h3>Tips</h3>

            <ul>
              {exercise.tips.map(
                (tip, index) => (
                  <li
                    key={`${exercise.id}-tip-${index}`}
                  >
                    {tip}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

        {exercise.tags.length > 0 && (
          <div className="exercise-detail-section">
            <h3>Tags</h3>

            <div className="tag-list">
              {exercise.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   STANDALONE ROUTE: /exercises/:exerciseId
   Client-accessible detail page (fallback for deep-link / share)
   ============================================================ */

export function ExerciseDetailPage() {
  const { exerciseId } = useParams<{
    exerciseId: string;
  }>();

  const [exercise, setExercise] =
    useState<ExerciseDetailView | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!exerciseId) {
      setError("Missing exercise id.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await getExercise(
          exerciseId!,
        );

        if (!data) {
          if (!cancelled) {
            setError("Exercise not found.");
          }
          return;
        }

        const previewPath =
          data.media?.classic?.start ??
          data.media?.flat?.start ??
          data.media?.classic?.peak ??
          data.media?.flat?.peak ??
          data.media?.thumbnail ??
          null;

        const [previewUrl, animationUrl] =
          await Promise.all([
            resolveStorageUrl(previewPath),
            resolveStorageUrl(
              data.media?.animation ??
                data.media?.gif ??
                null,
            ),
          ]);

        if (!cancelled) {
          setExercise({
            ...data,
            previewUrl,
            animationUrl,
          });
        }
      } catch (err) {
        console.error(
          "Failed to load exercise:",
          err,
        );

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load exercise.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  if (loading) {
    return (
      <div className="content">
        <div className="page-title">
          <span className="eyebrow">
            Exercise
          </span>
          <h1>Loading exercise…</h1>
          <p className="muted">
            Preparing details.
          </p>
        </div>
      </div>
    );
  }

  if (error || !exercise) {
    return (
      <div className="content">
        <Link
          to="/my-program"
          className="back-link"
        >
          <ArrowLeft size={14} />
          Back to My Program
        </Link>

        <section className="section-card">
          <span className="eyebrow danger">
            Exercise
          </span>
          <h2>
            {error ?? "Exercise not found."}
          </h2>
          <p className="muted">
            The requested exercise could
            not be found.
          </p>

          <Link
            to="/my-program"
            className="secondary-button"
            style={{ marginTop: "16px" }}
          >
            <ArrowLeft size={16} />
            Back to My Program
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="content">
      <Link
        to="/my-program"
        className="back-link"
      >
        <ArrowLeft size={14} />
        Back to My Program
      </Link>

      <div className="exercise-modal-backdrop exercise-detail-page-backdrop">
        <div className="exercise-modal exercise-detail-page-modal">
          <ExerciseDetailContent
            exercise={exercise}
          />
        </div>
      </div>

      <style>{`
        .exercise-detail-page-backdrop {
          position: static;
          inset: auto;
          background: transparent;
          backdrop-filter: none;
          padding: 0;
          overflow: visible;
        }
        .exercise-detail-page-modal {
          width: 100%;
          max-height: none;
          overflow: visible;
        }
        .exercise-detail-page-modal .exercise-detail {
          overflow: visible;
        }
      `}</style>
    </div>
  );
}
