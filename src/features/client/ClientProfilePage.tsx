import { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";

import {
  getClientProfile,
  upsertClientProfile,
} from "../../services/firestore";

import type { ClientProfile } from "../../types/models";

/* ============================================================
   PRIMARY GOAL OPTIONS
   ------------------------------------------------------------
   The client can select multiple goals.
   Selecting "Other" reveals a custom input.
   ============================================================ */

const GOAL_OPTIONS = [
  "Build strength",
  "Build muscle",
  "Lose fat",
  "Improve endurance",
  "Improve mobility",
  "General fitness",
  "Improve athletic performance",
  "Health & wellness",
  "Other",
];

/* ============================================================
   CLIENT PROFILE PAGE
   ============================================================ */

export function ClientProfilePage() {
  const {
    profile,
    firebaseUser,
  } = useAuth();

  /* ==========================================================
     FORM STATE
     ========================================================== */

  const [
    form,
    setForm,
  ] = useState<Partial<ClientProfile>>({
    displayName: profile?.displayName ?? "",
    email:
      profile?.email ??
      firebaseUser?.email ??
      "",
    age: undefined,
    fitnessLevel: "beginner",
    primaryGoals: [],
    preferredSessionMinutes: 45,
    trainingDaysPerWeek: 3,
    availableEquipment: ["Full gym"],
    exercisesPreferred: [],
    exercisesAvoid: [],
    restrictions: [],
  });

  /* ==========================================================
     OTHER GOAL
     ========================================================== */

  const [
    otherGoal,
    setOtherGoal,
  ] = useState("");

  /* ==========================================================
     UI STATE
     ========================================================== */

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    saved,
    setSaved,
  ] = useState(false);

  const [
    loadingProfile,
    setLoadingProfile,
  ] = useState(true);

  /* ==========================================================
     GENERIC FIELD UPDATE
     ========================================================== */

  function setField<K extends keyof ClientProfile>(
    key: K,
    value: ClientProfile[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  /* ==========================================================
     LOAD EXISTING PROFILE
     ----------------------------------------------------------
     Loads clientProfiles/{uid} when the page opens.
     ========================================================== */

  useEffect(() => {
    if (!firebaseUser) {
      setLoadingProfile(false);
      return;
    }

    /*
     * Capture the UID here so TypeScript knows it is
     * definitely a string inside the async function.
     */
    const uid = firebaseUser.uid;
    const authEmail = firebaseUser.email ?? "";

    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);

      try {
        const savedProfile =
          await getClientProfile(uid);

        if (cancelled) {
          return;
        }

        /* ----------------------------------------------
           Existing profile found
           ---------------------------------------------- */

        if (savedProfile) {
          setForm({
            displayName:
              savedProfile.displayName ??
              profile?.displayName ??
              "",

           email:
  savedProfile.email ??
  profile?.email ??
  authEmail,

            age:
              savedProfile.age,

            sex:
              savedProfile.sex,

            heightCm:
              savedProfile.heightCm,

            weightKg:
              savedProfile.weightKg,

            targetWeightKg:
              savedProfile.targetWeightKg,

            bodyFatPercent:
              savedProfile.bodyFatPercent,

            fitnessLevel:
              savedProfile.fitnessLevel ??
              "beginner",

            primaryGoals:
              savedProfile.primaryGoals ??
              [],

            preferredSessionMinutes:
              savedProfile.preferredSessionMinutes ??
              45,

            trainingDaysPerWeek:
              savedProfile.trainingDaysPerWeek ??
              3,

            availableEquipment:
              savedProfile.availableEquipment ??
              [],

            exercisesPreferred:
              savedProfile.exercisesPreferred ??
              [],

            exercisesAvoid:
              savedProfile.exercisesAvoid ??
              [],

            restrictions:
              savedProfile.restrictions ??
              [],
          });

          /*
           * Restore custom "Other" goal if it exists.
           */
          const storedOther =
            (
              savedProfile.primaryGoals ??
              []
            ).find((goal) =>
              goal.startsWith("Other: "),
            );

          if (storedOther) {
            setOtherGoal(
              storedOther.replace(
                "Other: ",
                "",
              ),
            );
          }
        }

        /* ----------------------------------------------
           No profile yet
           ---------------------------------------------- */

        else {
          setForm((current) => ({
            ...current,
            displayName:
              profile?.displayName ??
              current.displayName ??
              "",

           
          }));
        }
      } catch (error) {
        console.error(
          "Failed to load client profile:",
          error,
        );
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid]);

  /* ==========================================================
     MULTIPLE GOAL SELECTION
     ========================================================== */

  function toggleGoal(goal: string) {
    const currentGoals =
      form.primaryGoals ?? [];

    /*
     * Remove goal if already selected.
     */
    if (currentGoals.includes(goal)) {
      setField(
        "primaryGoals",
        currentGoals.filter(
          (item) => item !== goal,
        ),
      );

      /*
       * Clear custom text if "Other" is deselected.
       */
      if (goal === "Other") {
        setOtherGoal("");
      }

      return;
    }

    /*
     * Add new goal.
     */
    setField(
      "primaryGoals",
      [
        ...currentGoals,
        goal,
      ],
    );
  }

  /* ==========================================================
     SAVE PROFILE
     ========================================================== */

  async function save(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    /*
     * Guard against missing authentication.
     */
    if (!firebaseUser) {
      return;
    }

    /*
     * Capture UID so TypeScript knows it cannot be null
     * inside the async operation.
     */
    const uid = firebaseUser.uid;


    setSaving(true);
    setSaved(false);

    try {
      /*
       * Copy selected goals.
       */
      const goals = [
        ...(form.primaryGoals ?? []),
      ];

      /*
       * Replace "Other" with its custom description.
       *
       * Example:
       * Other
       * →
       * Other: Prepare for a hiking expedition
       */
      const otherIndex =
        goals.indexOf("Other");

      if (
        otherIndex !== -1 &&
        otherGoal.trim()
      ) {
        goals[otherIndex] =
          `Other: ${otherGoal.trim()}`;
      }

      /*
       * Save the complete client profile.
       */
      await upsertClientProfile({
        uid,

        displayName:
          String(
            form.displayName ?? "",
          ),

        email:
          String(
            form.email ??
            firebaseUser.email ??
            "",
          ),

        age:
          form.age,

        sex:
          form.sex,

        heightCm:
          form.heightCm,

        weightKg:
          form.weightKg,

        targetWeightKg:
          form.targetWeightKg,

        bodyFatPercent:
          form.bodyFatPercent,

        fitnessLevel:
          form.fitnessLevel,

        primaryGoals:
          goals,

        preferredSessionMinutes:
          form.preferredSessionMinutes,

        trainingDaysPerWeek:
          form.trainingDaysPerWeek,

        availableEquipment:
          form.availableEquipment,

        exercisesPreferred:
          form.exercisesPreferred,

        exercisesAvoid:
          form.exercisesAvoid,

        restrictions:
          form.restrictions,
      } as ClientProfile);

      /*
       * Show confirmation.
       */
      setSaved(true);

      /*
       * Hide confirmation after 3 seconds.
       */
      window.setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error(
        "Error saving profile:",
        error,
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     LOADING SCREEN
     ========================================================== */

  if (loadingProfile) {
    return (
      <div className="center-screen">

        <div className="glass-card narrow">

          <span className="eyebrow">
            ARIA
          </span>

          <h2>
            Loading your profile…
          </h2>

          <p className="muted">
            Preparing your training context.
          </p>

        </div>

      </div>
    );
  }

  /* ==========================================================
     PAGE
     ========================================================== */

  return (
    <div className="content">

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <div className="page-title">

        <span className="eyebrow">
          Profile
        </span>

        <h1>
          Tell ARIA what it needs to know.
        </h1>

        <p className="muted">
          Only training-relevant information is
          included in this first version.
        </p>

      </div>


      {/* ======================================================
          PROFILE FORM
          ====================================================== */}

      <form
        className="section-card form-grid"
        onSubmit={save}
      >

        {/* ----------------------------------------------------
            FULL NAME
            ---------------------------------------------------- */}

        <label>
          Full name

          <input
            value={
              String(
                form.displayName ?? "",
              )
            }
            onChange={(event) =>
              setField(
                "displayName",
                event.target.value,
              )
            }
          />
        </label>


        {/* ----------------------------------------------------
            EMAIL
            ---------------------------------------------------- */}

        <label>
          Email

          <input
            value={
              String(
                form.email ?? "",
              )
            }
            readOnly
          />
        </label>
 {/* ----------------------------------------------------
            SEX
            ---------------------------------------------------- */}
            <label>
  Sex

  <select
    value={form.sex ?? ""}
    onChange={(event) =>
      setField(
        "sex",
        event.target.value
          ? event.target.value as ClientProfile["sex"]
          : undefined,
      )
    }
  >
    <option value="">
      Select
    </option>

    <option value="male">
      Male
    </option>

    <option value="female">
      Female
    </option>

    <option value="prefer_not_to_say">
      Prefer not to say
    </option>
  </select>
</label>

        {/* ----------------------------------------------------
            AGE
            ---------------------------------------------------- */}

        <label>
          Age

          <input
            type="number"
            min="13"
            max="120"
            value={
              form.age ?? ""
            }
            onChange={(event) =>
              setField(
                "age",
                event.target.value
                  ? Number(
                      event.target.value,
                    )
                  : undefined,
              )
            }
          />
        </label>


        {/* ----------------------------------------------------
            HEIGHT
            ---------------------------------------------------- */}

        <label>
          Height (cm)

          <input
            type="number"
            min="50"
            max="250"
            value={
              form.heightCm ?? ""
            }
            onChange={(event) =>
              setField(
                "heightCm",
                event.target.value
                  ? Number(
                      event.target.value,
                    )
                  : undefined,
              )
            }
          />
        </label>


        {/* ----------------------------------------------------
            WEIGHT
            ---------------------------------------------------- */}

        <label>
          Weight (kg)

          <input
            type="number"
            min="20"
            max="400"
            step="0.1"
            value={
              form.weightKg ?? ""
            }
            onChange={(event) =>
              setField(
                "weightKg",
                event.target.value
                  ? Number(
                      event.target.value,
                    )
                  : undefined,
              )
            }
          />
        </label>


        {/* ----------------------------------------------------
            TARGET WEIGHT
            ---------------------------------------------------- */}

        <label>
          Target weight (kg)

          <input
            type="number"
            min="20"
            max="400"
            step="0.1"
            value={
              form.targetWeightKg ?? ""
            }
            onChange={(event) =>
              setField(
                "targetWeightKg",
                event.target.value
                  ? Number(
                      event.target.value,
                    )
                  : undefined,
              )
            }
          />
        </label>

        {/* ----------------------------------------------------
            BODY FAT PERCENTAGE
            ---------------------------------------------------- */}

        <label>
          Body fat percentage (%)

          <input
            type="number"
            min="5"
            max="70"
            step="0.1"
            value={
              form.bodyFatPercent ??
              ""
            }
            onChange={(event) =>
              setField(
                "bodyFatPercent",
                event.target.value
                  ? Number(
                      event.target.value,
                    )
                  : undefined,
              )
            }
          />
        </label>


        {/* ----------------------------------------------------
            FITNESS LEVEL
            ---------------------------------------------------- */}

        <label>
          Fitness level

          <select
            value={
              form.fitnessLevel ??
              "beginner"
            }
            onChange={(event) =>
              setField(
                "fitnessLevel",
                event.target
                  .value as ClientProfile[
                  "fitnessLevel"
                ],
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


        {/* ====================================================
            PRIMARY GOALS
            ==================================================== */}

        <div className="span-2 goal-selector">

          <div className="field-title">
            Primary goals
          </div>

          <div className="goal-options">

            {GOAL_OPTIONS.map(
              (goal) => {

                const selected =
                  form.primaryGoals?.includes(
                    goal,
                  ) ?? false;

                return (
                  <button
                    key={goal}
                    type="button"
                    className={
                      `goal-option ${
                        selected
                          ? "selected"
                          : ""
                      }`
                    }
                    onClick={() =>
                      toggleGoal(goal)
                    }
                  >
                    <span className="goal-check">
                      {selected
                        ? "✓"
                        : ""}
                    </span>

                    {goal}
                  </button>
                );
              },
            )}

          </div>


          {/* --------------------------------------------------
              CUSTOM OTHER GOAL
              -------------------------------------------------- */}

          {form.primaryGoals?.includes(
            "Other",
          ) && (
            <div className="other-goal">

              <label>
                Tell ARIA about your other goal

                <input
                  type="text"
                  value={otherGoal}
                  onChange={(event) =>
                    setOtherGoal(
                      event.target.value,
                    )
                  }
                  placeholder="Example: Prepare for a hiking trip"
                />
              </label>

            </div>
          )}

        </div>


        {/* ----------------------------------------------------
            TRAINING DAYS
            ---------------------------------------------------- */}

        <label>
          Training days / week

          <input
            type="number"
            min="1"
            max="7"
            value={
              form.trainingDaysPerWeek ??
              3
            }
            onChange={(event) =>
              setField(
                "trainingDaysPerWeek",
                Number(
                  event.target.value,
                ),
              )
            }
          />
        </label>


        {/* ----------------------------------------------------
            SESSION LENGTH
            ---------------------------------------------------- */}

        <label>
          Session minutes

          <input
            type="number"
            min="15"
            max="180"
            value={
              form.preferredSessionMinutes ??
              45
            }
            onChange={(event) =>
              setField(
                "preferredSessionMinutes",
                Number(
                  event.target.value,
                ),
              )
            }
          />
        </label>


        {/* ----------------------------------------------------
            EQUIPMENT
            ---------------------------------------------------- */}

        <label className="span-2">
          Available equipment

          <input
            value={
              (
                form.availableEquipment ??
                []
              ).join(", ")
            }
            onChange={(event) =>
              setField(
                "availableEquipment",
                event.target.value
                  .split(",")
                  .map(
                    (value) =>
                      value.trim(),
                  )
                  .filter(Boolean),
              )
            }
            placeholder="Example: Full gym, dumbbells, resistance bands"
          />
        </label>


        {/* ----------------------------------------------------
            EXERCISES TO AVOID
            ---------------------------------------------------- */}

        <label className="span-2">
          Exercises to avoid

          <input
            value={
              (
                form.exercisesAvoid ??
                []
              ).join(", ")
            }
            onChange={(event) =>
              setField(
                "exercisesAvoid",
                event.target.value
                  .split(",")
                  .map(
                    (value) =>
                      value.trim(),
                  )
                  .filter(Boolean),
              )
            }
            placeholder="Example: Barbell back squat"
          />
        </label>


        {/* ----------------------------------------------------
            RESTRICTIONS / NOTES
            ---------------------------------------------------- */}

        <label className="span-2">
          Restrictions / relevant notes

          <textarea
            value={
              (
                form.restrictions ??
                []
              ).join("\n")
            }
            onChange={(event) =>
              setField(
                "restrictions",
                event.target.value
                  .split("\n")
                  .filter(Boolean),
              )
            }
            placeholder="Anything ARIA should know about your training."
          />
        </label>


        {/* ====================================================
            SAVE
            ==================================================== */}

        <div className="span-2 actions">

          {saved && (
            <div className="save-success">

              <span className="save-success-icon">
                ✓
              </span>

              <span>
                Profile saved successfully
              </span>

            </div>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : "Save profile"}
          </button>

        </div>

      </form>

    </div>
  );
}