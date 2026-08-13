import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Dumbbell,
  Headphones,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { getClientProfile } from "../../services/firestore";

import type { ClientProfile } from "../../types/models";

/* ============================================================
   CLIENT DASHBOARD
   ------------------------------------------------------------
   The authenticated user document (`users/{uid}`) contains
   account information such as role and status.

   The training information lives in:
   `clientProfiles/{uid}`

   Therefore this dashboard loads both:
   - Auth/account context from AuthContext
   - Training/client context from Firestore
   ============================================================ */

export function ClientDashboard() {
  const {
    profile,
    firebaseUser,
  } = useAuth();

  /* ==========================================================
     CLIENT PROFILE STATE
     ========================================================== */

  const [
    clientProfile,
    setClientProfile,
  ] = useState<ClientProfile | null>(null);

  const [
    profileLoading,
    setProfileLoading,
  ] = useState(true);

  /* ==========================================================
     LOAD CLIENT PROFILE
     ========================================================== */

 useEffect(() => {
  if (!firebaseUser) {
    setClientProfile(null);
    setProfileLoading(false);
    return;
  }

  const uid = firebaseUser.uid;
  let cancelled = false;

  async function loadClientProfile() {
    setProfileLoading(true);

    try {
      const data = await getClientProfile(uid);

      if (!cancelled) {
        setClientProfile(data);
      }
    } catch (error) {
      console.error(
        "Failed to load client profile:",
        error,
      );

      if (!cancelled) {
        setClientProfile(null);
      }
    } finally {
      if (!cancelled) {
        setProfileLoading(false);
      }
    }
  }

  void loadClientProfile();

  return () => {
    cancelled = true;
  };
}, [firebaseUser]);

  /* ==========================================================
     DISPLAY NAME
     ========================================================== */

  const name =
    clientProfile?.displayName ||
    profile?.displayName ||
    firebaseUser?.displayName ||
    "there";

  /* ==========================================================
     PRIMARY GOALS
     ========================================================== */

  const goals =
    clientProfile?.primaryGoals ?? [];

  const goalsText =
    goals.length > 0
      ? goals.join(", ")
      : "Not set";


  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="dashboard">

      {/* ======================================================
          HERO
          ====================================================== */}

      <section className="hero-card">

        <div>

          <span className="eyebrow">
            Your voice coach
          </span>

          <h1>
            Hey {name.split(" ")[0]}.<br />
            ARIA is ready.
          </h1>

          <p>
            Start a workout and let the coach guide
            the session using your profile and training
            context.
          </p>

        </div>

        <div className="aria-orb">
          <Headphones size={46} />
        </div>

        <Link
          className="primary-button inline-button"
          to="/workout"
        >
          Start workout
          <ArrowUpRight size={18} />
        </Link>

      </section>


      {/* ======================================================
          QUICK STATS
          ====================================================== */}

      <section className="stats-grid">

        {/* Next focus */}
        <article className="stat-card">

          <Dumbbell size={18} />

          <span>
            Primary goals
          </span>

          <strong>
            {profileLoading
              ? "Loading…"
              : goalsText}
          </strong>

        </article>


        {/* Preferred session */}
        <article className="stat-card">

          <CalendarDays size={18} />

          <span>
            Preferred session
          </span>

          <strong>
            {profileLoading
              ? "Loading…"
              : `${clientProfile?.preferredSessionMinutes ?? 45} min`}
          </strong>

        </article>


        {/* ARIA status */}
        <article className="stat-card">

          <Sparkles size={18} />

          <span>
            ARIA
          </span>

          <strong>
            {profileLoading
              ? "Loading profile…"
              : "Voice coach ready"}
          </strong>

        </article>

      </section>


      {/* ======================================================
          CLIENT CONTEXT
          ====================================================== */}

      <section className="section-card">

        <div className="section-heading">

          <div>

            <span className="eyebrow">
              Client context
            </span>

            <h2>
              What ARIA will use
            </h2>

          </div>

        </div>


        <div className="feature-grid">

          {/* Goals */}
          <div>

            <strong>
              Goals
            </strong>

            <span>
              {profileLoading
                ? "Loading…"
                : goalsText}
            </span>

          </div>


          {/* Experience */}
          <div>

            <strong>
              Experience
            </strong>

            <span>
              {profileLoading
                ? "Loading…"
                : clientProfile?.fitnessLevel ||
                  "Not set"}
            </span>

          </div>


          {/* Equipment */}
          <div>

            <strong>
              Equipment
            </strong>

            <span>
              {profileLoading
                ? "Loading…"
                : clientProfile?.availableEquipment?.length
                  ? clientProfile.availableEquipment.join(", ")
                  : "Not set"}
            </span>

          </div>


          {/* Training days */}
          <div>

            <strong>
              Training days
            </strong>

            <span>
              {profileLoading
                ? "Loading…"
                : clientProfile?.trainingDaysPerWeek ??
                  "Not set"}
            </span>

          </div>

        </div>

      </section>

    </div>
  );
}