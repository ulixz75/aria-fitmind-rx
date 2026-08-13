import {
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";

import type { ReactNode } from "react";

import { useAuth } from "../context/AuthContext";

import { AuthPage } from "../features/auth/AuthPage";

import { ClientDashboard } from "../features/client/ClientDashboard";
import { ClientProfilePage } from "../features/client/ClientProfilePage";

import { WorkoutPage } from "../features/workout/WorkoutPage";

import { AdminDashboard } from "../features/admin/AdminDashboard";
import { AdminUsersPage } from "../features/admin/AdminUsersPage";

/* ============================================================
   APP SHELL
   ------------------------------------------------------------
   Shared layout for authenticated users.
   ============================================================ */

function Shell({
  children,
}: {
  children: ReactNode;
}) {
  const { profile, logout } = useAuth();
  const location = useLocation();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="app-shell">

      {/* ======================================================
          TOP NAVIGATION
          ====================================================== */}

      <header className="topbar">

        <Link
          to={isAdmin ? "/admin" : "/"}
          className="brand"
        >
          <span className="brand-mark">
            AR
          </span>

          <span>
            <strong>ARIA</strong>
            <small>FitMind Rx</small>
          </span>
        </Link>

        <nav className="nav">

          {isAdmin ? (
            <>
              <Link
                to="/admin"
                className={
                  location.pathname === "/admin"
                    ? "active"
                    : ""
                }
              >
                Overview
              </Link>

              <Link
                to="/admin/users"
                className={
                  location.pathname.startsWith("/admin/users")
                    ? "active"
                    : ""
                }
              >
                Users
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/"
                className={
                  location.pathname === "/"
                    ? "active"
                    : ""
                }
              >
                Home
              </Link>

              <Link
                to="/workout"
                className={
                  location.pathname.startsWith("/workout")
                    ? "active"
                    : ""
                }
              >
                Coach
              </Link>

              <Link
                to="/profile"
                className={
                  location.pathname.startsWith("/profile")
                    ? "active"
                    : ""
                }
              >
                Profile
              </Link>
            </>
          )}

          <button
            type="button"
            className="nav-button"
            onClick={() => void logout()}
          >
            Sign out
          </button>

        </nav>
      </header>

      <main className="page">
        {children}
      </main>

    </div>
  );
}


/* ============================================================
   LOADING SCREEN
   ============================================================ */

function LoadingScreen() {
  return (
    <div className="center-screen">
      <div className="glass-card narrow loading-card">
        <div className="loading-orb">
          <span>AR</span>
        </div>

        <h2>Preparing ARIA…</h2>

        <p className="muted">
          Checking your account and access status.
        </p>
      </div>
    </div>
  );
}


/* ============================================================
   PENDING ACCOUNT
   ============================================================ */

function PendingPage() {
  const { logout } = useAuth();

  return (
    <div className="center-screen">

      <div className="glass-card narrow">

        <span className="eyebrow">
          Account pending
        </span>

        <h1>
          Your ARIA account is waiting for approval.
        </h1>

        <p className="muted">
          An administrator must approve your account
          before your client portal becomes available.
        </p>

        <div className="pending-status">
          <span className="pending-dot" />
          Waiting for administrator approval
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => void logout()}
        >
          Sign out
        </button>

      </div>

    </div>
  );
}


/* ============================================================
   SUSPENDED ACCOUNT
   ============================================================ */

function SuspendedPage() {
  const { logout } = useAuth();

  return (
    <div className="center-screen">

      <div className="glass-card narrow">

        <span className="eyebrow danger">
          Account suspended
        </span>

        <h1>
          Access is currently suspended.
        </h1>

        <p className="muted">
          Please contact FitMind Rx support if you believe
          this was done in error.
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={() => void logout()}
        >
          Sign out
        </button>

      </div>

    </div>
  );
}


/* ============================================================
   CLIENT ACCESS GUARD
   ------------------------------------------------------------
   Only:
     role = client
     status = active

   can enter client pages.
   ============================================================ */

function ClientGuard({
  children,
}: {
  children: ReactNode;
}) {
  const {
    firebaseUser,
    profile,
    loading,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  /*
   * Firebase user exists but Firestore profile
   * cannot be verified.
   *
   * Fail closed.
   */
  if (!profile) {
    return <LoadingScreen />;
  }

  /*
   * Admins belong to the admin portal.
   */
  if (profile.role === "admin") {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  /*
   * New client awaiting approval.
   */
  if (profile.status === "pending") {
    return <PendingPage />;
  }

  /*
   * Suspended client.
   */
  if (profile.status === "suspended") {
    return <SuspendedPage />;
  }

  /*
   * Any unknown status fails closed.
   */
  if (profile.status !== "active") {
    return <PendingPage />;
  }

  /*
   * Approved client.
   */
  return <>{children}</>;
}


/* ============================================================
   ADMIN ACCESS GUARD
   ------------------------------------------------------------
   Only:
     role = admin
     status = active

   can access admin pages.
   ============================================================ */

function AdminGuard({
  children,
}: {
  children: ReactNode;
}) {
  const {
    firebaseUser,
    profile,
    loading,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  if (!profile) {
    return <LoadingScreen />;
  }

  /*
   * Only active admins are allowed.
   */
  if (
    profile.role !== "admin" ||
    profile.status !== "active"
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return <>{children}</>;
}


/* ============================================================
   AUTHENTICATED ROUTE AREA
   ============================================================ */

function AuthenticatedRoutes() {
  const {
    firebaseUser,
    profile,
    loading,
  } = useAuth();

  /*
   * Extremely important:
   *
   * We DO NOT redirect anywhere while auth/profile is loading.
   *
   * This prevents the redirect loop that caused:
   * "Maximum update depth exceeded".
   */
  if (loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  if (!profile) {
    return <LoadingScreen />;
  }

  /*
   * Pending users should never enter the client routes.
   */
  if (
    profile.role === "client" &&
    profile.status === "pending"
  ) {
    return <PendingPage />;
  }

  /*
   * Suspended users should never enter the client routes.
   */
  if (
    profile.role === "client" &&
    profile.status === "suspended"
  ) {
    return <SuspendedPage />;
  }

  return (
    <Shell>
      <Routes>

        {/* ====================================================
            CLIENT HOME
            ==================================================== */}

        <Route
          path="/"
          element={
            <ClientGuard>
              <ClientDashboard />
            </ClientGuard>
          }
        />

        {/* ====================================================
            CLIENT COACH
            ==================================================== */}

        <Route
          path="/workout"
          element={
            <ClientGuard>
              <WorkoutPage />
            </ClientGuard>
          }
        />

        {/* ====================================================
            CLIENT PROFILE
            ==================================================== */}

        <Route
          path="/profile"
          element={
            <ClientGuard>
              <ClientProfilePage />
            </ClientGuard>
          }
        />

        {/* ====================================================
            ADMIN
            ==================================================== */}

        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminDashboard />
            </AdminGuard>
          }
        />

        <Route
          path="/admin/users"
          element={
            <AdminGuard>
              <AdminUsersPage />
            </AdminGuard>
          }
        />

        {/* ====================================================
            UNKNOWN AUTHENTICATED ROUTE
            ==================================================== */}

        <Route
          path="*"
          element={
            profile.role === "admin"
              ? (
                <Navigate
                  to="/admin"
                  replace
                />
              )
              : (
                <Navigate
                  to="/"
                  replace
                />
              )
          }
        />

      </Routes>
    </Shell>
  );
}


/* ============================================================
   MAIN APP
   ============================================================ */

export default function App() {
  const {
    firebaseUser,
    loading,
  } = useAuth();

  /*
   * Initial Firebase authentication check.
   */
  if (loading) {
    return <LoadingScreen />;
  }

  /*
   * Not authenticated.
   */
  if (!firebaseUser) {
    return (
      <Routes>

        <Route
          path="/auth"
          element={<AuthPage />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/auth"
              replace
            />
          }
        />

      </Routes>
    );
  }

  /*
   * Authenticated user.
   *
   * We intentionally let AuthenticatedRoutes decide whether
   * the user is pending, suspended, client or admin.
   */
  return <AuthenticatedRoutes />;
}