import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Dumbbell,
  Play,
  ChevronRight,
  X,
} from "lucide-react";

import {
  listExercises,
  resolveStorageUrl,
} from "../../services/firestore";

import type { Exercise } from "../../types/exercises";

type ExerciseView = Exercise & {
  previewUrl: string | null;
  animationUrl: string | null;
};

export function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<ExerciseView[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExerciseView | null>(null);

  useEffect(() => {
    async function loadExercises() {
      try {
        const data = await listExercises();

        const resolved = await Promise.all(
          data.map(async (exercise) => {
            const previewPath =
              exercise.media?.classic?.start ??
              exercise.media?.flat?.start ??
              exercise.media?.classic?.peak ??
              exercise.media?.flat?.peak ??
              exercise.media?.thumbnail ??
              null;

            const previewUrl =
              await resolveStorageUrl(previewPath);

            const animationUrl =
              await resolveStorageUrl(
                exercise.media?.animation ??
                exercise.media?.gif ??
                null,
              );

            return {
              ...exercise,
              previewUrl,
              animationUrl,
            };
          }),
        );

        setExercises(resolved);
      } catch (error) {
        console.error(
          "Failed to load exercises:",
          error,
        );

        setExercises([]);
      } finally {
        setLoading(false);
      }
    }

    void loadExercises();
  }, []);

  const filteredExercises = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return exercises;
    }

    return exercises.filter((exercise) => {
      const searchableContent = [
        exercise.name,
        exercise.description,
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

      return searchableContent.includes(term);
    });
  }, [exercises, search]);

  if (loading) {
    return (
      <div className="content">
        <div className="page-title">
          <span className="eyebrow">
            Admin / exercises
          </span>

          <h1>Exercise Library.</h1>

          <p className="muted">
            Loading ARIA's exercise database…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="page-title">
        <span className="eyebrow">
          Admin / exercises
        </span>

        <h1>Exercise Library.</h1>

        <p className="muted">
          Browse the exercise reference library used by
          ARIA coaching programs.
        </p>
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={17} />

          <input
            type="search"
            placeholder="Search exercises, muscles, equipment…"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="status-badge active">
          {filteredExercises.length} exercises
        </div>
      </div>

      {filteredExercises.length === 0 ? (
        <section className="section-card">
          <div className="empty">
            No exercises found.
          </div>
        </section>
      ) : (
        <section className="exercise-grid">
          {filteredExercises.map((exercise) => (
            <article
              className="exercise-card"
              key={exercise.id}
            >
              <div className="exercise-media">
                {exercise.previewUrl ? (
                  <img
                    src={exercise.previewUrl}
                    alt={exercise.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="exercise-placeholder">
                    <Dumbbell size={30} />
                    <span>No preview</span>
                  </div>
                )}

                {exercise.animationUrl && (
                  <div className="exercise-animation-badge">
                    <Play size={12} />
                    Animation
                  </div>
                )}
              </div>

              <div className="exercise-card-body">
                <span className="eyebrow">
                  {exercise.category}
                </span>

                <h2>{exercise.name}</h2>

                <p className="muted">
                  {exercise.description}
                </p>

                <div className="exercise-meta">
                  <span>
                    {exercise.difficulty}
                  </span>

                  <span>
                    {exercise.bodyPart}
                  </span>
                </div>

                <button
                  type="button"
                  className="secondary-button exercise-view-button"
                  onClick={() =>
                    setSelected(exercise)
                  }
                >
                  View exercise
                  <ChevronRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {selected && (
        <div
          className="exercise-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <div
            className="exercise-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close exercise details"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>

            <div className="exercise-detail-media">
              {selected.animationUrl ? (
                <img
                  src={selected.animationUrl}
                  alt={selected.name}
                />
              ) : selected.previewUrl ? (
                <img
                  src={selected.previewUrl}
                  alt={selected.name}
                />
              ) : (
                <div className="exercise-placeholder">
                  <Dumbbell size={40} />
                  <span>No preview available</span>
                </div>
              )}
            </div>

            <div className="exercise-detail">
              <span className="eyebrow">
                {selected.category}
              </span>

              <h2>{selected.name}</h2>

              <p className="muted">
                {selected.description}
              </p>

              <div className="exercise-detail-grid">
                <div>
                  <strong>Difficulty</strong>
                  <span>{selected.difficulty}</span>
                </div>

                <div>
                  <strong>Body part</strong>
                  <span>{selected.bodyPart}</span>
                </div>

                <div>
                  <strong>Equipment</strong>
                  <span>
                    {selected.equipment.length > 0
                      ? selected.equipment.join(", ")
                      : "None"}
                  </span>
                </div>

                <div>
                  <strong>Mechanic</strong>
                  <span>{selected.mechanic}</span>
                </div>
              </div>

              {selected.primaryMuscles.length > 0 && (
                <div className="exercise-detail-section">
                  <h3>Primary muscles</h3>

                  <div className="tag-list">
                    {selected.primaryMuscles.map(
                      (muscle) => (
                        <span key={muscle}>
                          {muscle}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {selected.secondaryMuscles.length > 0 && (
                <div className="exercise-detail-section">
                  <h3>Secondary muscles</h3>

                  <div className="tag-list">
                    {selected.secondaryMuscles.map(
                      (muscle) => (
                        <span key={muscle}>
                          {muscle}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {selected.goals.length > 0 && (
                <div className="exercise-detail-section">
                  <h3>Goals</h3>

                  <div className="tag-list">
                    {selected.goals.map((goal) => (
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
                  {selected.instructions.map(
                    (instruction, index) => (
                      <li
                        key={`${selected.id}-instruction-${index}`}
                      >
                        {instruction}
                      </li>
                    ),
                  )}
                </ol>
              </div>

              {selected.tips.length > 0 && (
                <div className="exercise-detail-section">
                  <h3>Tips</h3>

                  <ul>
                    {selected.tips.map(
                      (tip, index) => (
                        <li
                          key={`${selected.id}-tip-${index}`}
                        >
                          {tip}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              {selected.tags.length > 0 && (
                <div className="exercise-detail-section">
                  <h3>Tags</h3>

                  <div className="tag-list">
                    {selected.tags.map((tag) => (
                      <span key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}