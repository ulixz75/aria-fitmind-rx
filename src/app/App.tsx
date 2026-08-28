import {
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  Menu,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { InstallPrompt } from "../components/InstallPrompt";

import { AuthPage } from "../features/auth/AuthPage";

import { ClientDashboard } from "../features/client/ClientDashboard";
import { ClientProfilePage } from "../features/client/ClientProfilePage";

import { WorkoutPage } from "../features/workout/WorkoutPage";

import { AdminDashboard } from "../features/admin/AdminDashboard";
import { AdminUsersPage } from "../features/admin/AdminUsersPage";
import { ExerciseLibraryPage } from "../features/admin/ExerciseLibraryPage";
import { ProgramsPage } from "../features/admin/ProgramsPage";
import { AdminClientsPage } from "../features/admin/AdminClientsPage";

import { MyProgramPage } from "../features/client/MyProgramPage";

/* ============================================================
   APP SHELL
   ------------------------------------------------------------
   Shared layout for authenticated users.
   Responsive navigation:
   - desktop: horizontal navigation
   - mobile/tablet: collapsible hamburger drawer
   ============================================================ */

function Shell({
  children,
}: {
  children: ReactNode;
}) {
  const {
    profile,
    logout,
  } = useAuth();

  const location =
    useLocation();

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const isAdmin =
    profile?.role === "admin";

  /* ==========================================================
     CLOSE MENU WHEN ROUTE CHANGES
     ========================================================== */

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  /* ==========================================================
     LOCK PAGE SCROLL WHILE MOBILE MENU IS OPEN
     ========================================================== */

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow =
        "";
      return;
    }

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [mobileMenuOpen]);

  /* ==========================================================
     ESCAPE KEY
     ========================================================== */

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape"
      ) {
        setMobileMenuOpen(
          false,
        );
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [mobileMenuOpen]);

  /* ==========================================================
     NAVIGATION LINK HELPERS
     ========================================================== */

  function isActivePath(
    path: string,
    exact = false,
  ) {
    if (exact) {
      return (
        location.pathname === path
      );
    }

    return location.pathname.startsWith(
      path,
    );
  }

  function closeMobileMenu() {
    setMobileMenuOpen(
      false,
    );
  }

  /* ==========================================================
     NAVIGATION
     ========================================================== */

  const navigation = isAdmin
    ? [
        {
          to: "/admin",
          label: "Overview",
          exact: true,
        },
        {
          to: "/admin/users",
          label: "Users",
          exact: false,
        },
        {
          to: "/admin/exercises",
          label: "Exercises",
          exact: false,
        },
        {
          to: "/admin/programs",
          label: "Programs",
          exact: false,
        },
        {
          to: "/admin/clients",
          label: "Clients",
          exact: false,
        },
      ]
    : [
        {
          to: "/",
          label: "Home",
          exact: true,
        },
        {
          to: "/workout",
          label: "Coach",
          exact: false,
        },
        {
          to: "/my-program",
          label: "My Program",
          exact: false,
        },
        {
          to: "/profile",
          label: "Profile",
          exact: false,
        },
      ];

  return (
    <div className="app-shell">
      {/* ======================================================
          TOP BAR
          ====================================================== */}

      <header className="topbar">
        {/* BRAND */}

        <Link
          to={
            isAdmin
              ? "/admin"
              : "/"
          }
          className="brand"
          onClick={
            closeMobileMenu
          }
        >
          <span className="brand-mark">
            AR
          </span>

          <span>
            <strong>
              ARIA
            </strong>

            <small>
              FitMind Rx
            </small>
          </span>
        </Link>

        {/* ====================================================
            DESKTOP NAVIGATION
            ==================================================== */}

        <nav
          className="nav desktop-nav"
          aria-label="Primary navigation"
        >
          {navigation.map(
            (item) => (
              <Link
                key={item.to}
                to={item.to}
                className={
                  isActivePath(
                    item.to,
                    item.exact,
                  )
                    ? "active"
                    : ""
                }
              >
                {item.label}
              </Link>
            ),
          )}

          <button
            type="button"
            className="nav-button"
            onClick={() =>
              void logout()
            }
          >
            Sign out
          </button>
        </nav>

        {/* ====================================================
            MOBILE MENU BUTTON
            ==================================================== */}

        <button
          type="button"
          className="mobile-menu-button"
          aria-label={
            mobileMenuOpen
              ? "Close navigation menu"
              : "Open navigation menu"
          }
          aria-expanded={
            mobileMenuOpen
          }
          aria-controls="aria-mobile-navigation"
          onClick={() =>
            setMobileMenuOpen(
              (current) =>
                !current,
            )
          }
        >
          {mobileMenuOpen ? (
            <X size={22} />
          ) : (
            <Menu size={22} />
          )}
        </button>
      </header>

      {/* ======================================================
          MOBILE OVERLAY
          ====================================================== */}

      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-menu-overlay"
          aria-label="Close navigation menu"
          onClick={
            closeMobileMenu
          }
        />
      )}

      {/* ======================================================
          MOBILE DRAWER
          ====================================================== */}

      <aside
        id="aria-mobile-navigation"
        className={`mobile-drawer ${
          mobileMenuOpen
            ? "open"
            : ""
        }`}
        aria-hidden={
          !mobileMenuOpen
        }
      >
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-title">
            <span className="brand-mark">
              AR
            </span>

            <div>
              <strong>
                ARIA
              </strong>

              <small>
                {isAdmin
                  ? "Admin Portal"
                  : "Client Portal"}
              </small>
            </div>
          </div>

          <button
            type="button"
            className="mobile-drawer-close"
            aria-label="Close navigation menu"
            onClick={
              closeMobileMenu
            }
          >
            <X size={20} />
          </button>
        </div>

        <div className="mobile-drawer-content">
          <span className="mobile-menu-eyebrow">
            Navigation
          </span>

          <nav
            className="mobile-nav"
            aria-label="Mobile navigation"
          >
            {navigation.map(
              (item) => {
                const active =
                  isActivePath(
                    item.to,
                    item.exact,
                  );

                return (
                  <Link
                    key={
                      item.to
                    }
                    to={
                      item.to
                    }
                    className={
                      active
                        ? "active"
                        : ""
                    }
                    onClick={
                      closeMobileMenu
                    }
                  >
                    <span>
                      {
                        item.label
                      }
                    </span>

                    {active && (
                      <span className="mobile-nav-indicator">
                        •
                      </span>
                    )}
                  </Link>
                );
              },
            )}

            <div className="mobile-nav-divider" />

            <button
              type="button"
              className="mobile-signout"
              onClick={() => {
                closeMobileMenu();
                void logout();
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </aside>

      {/* ======================================================
          PAGE
          ====================================================== */}

      <main className="page">
        {children}
        <footer style={{ marginTop: "50px", padding: "20px 0 10px", borderTop: "1px solid #ffffff05", textAlign: "center", fontSize: "11px", color: "#6f7b8c" }}>
          Ejercicios provistos por <a href="https://gymvisual.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#7cf7d4", textDecoration: "none" }}>Gym Visual</a>
        </footer>
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
          <span>
            AR
          </span>
        </div>

        <h2>
          Preparing ARIA…
        </h2>

        <p className="muted">
          Checking your account
          and access status.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   PENDING ACCOUNT
   ============================================================ */

function PendingPage() {
  const { logout } =
    useAuth();

  return (
    <div className="center-screen">
      <div className="glass-card narrow">
        <span className="eyebrow">
          Account pending
        </span>

        <h1>
          Your ARIA account
          is waiting for
          approval.
        </h1>

        <p className="muted">
          An administrator must
          approve your account
          before your client
          portal becomes
          available.
        </p>

        <div className="pending-status">
          <span className="pending-dot" />
          Waiting for
          administrator
          approval
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            void logout()
          }
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
  const { logout } =
    useAuth();

  return (
    <div className="center-screen">
      <div className="glass-card narrow">
        <span className="eyebrow danger">
          Account suspended
        </span>

        <h1>
          Access is
          currently
          suspended.
        </h1>

        <p className="muted">
          Please contact FitMind
          Rx support if you
          believe this was done
          in error.
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            void logout()
          }
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   CLIENT ACCESS GUARD
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

  if (!profile) {
    return <LoadingScreen />;
  }

  if (
    profile.role ===
    "admin"
  ) {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  if (
    profile.status ===
    "pending"
  ) {
    return <PendingPage />;
  }

  if (
    profile.status ===
    "suspended"
  ) {
    return <SuspendedPage />;
  }

  if (
    profile.status !==
    "active"
  ) {
    return <PendingPage />;
  }

  return (
    <>
      {children}
    </>
  );
}

/* ============================================================
   ADMIN ACCESS GUARD
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

  if (
    profile.role !==
      "admin" ||
    profile.status !==
      "active"
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <>
      {children}
    </>
  );
}

/* ============================================================
   AUTHENTICATED ROUTES
   ============================================================ */

function AuthenticatedRoutes() {
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

  if (
    profile.role ===
      "client" &&
    profile.status ===
      "pending"
  ) {
    return <PendingPage />;
  }

  if (
    profile.role ===
      "client" &&
    profile.status ===
      "suspended"
  ) {
    return <SuspendedPage />;
  }

  return (
    <Shell>
      <Routes>
        {/* CLIENT */}

        <Route
          path="/"
          element={
            <ClientGuard>
              <ClientDashboard />
            </ClientGuard>
          }
        />

        <Route
          path="/workout"
          element={
            <ClientGuard>
              <WorkoutPage />
            </ClientGuard>
          }
        />

        <Route
          path="/profile"
          element={
            <ClientGuard>
              <ClientProfilePage />
            </ClientGuard>
          }
        />

        <Route
          path="/my-program"
          element={
            <ClientGuard>
              <MyProgramPage />
            </ClientGuard>
          }
        />

        {/* ADMIN */}

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

        <Route
          path="/admin/exercises"
          element={
            <AdminGuard>
              <ExerciseLibraryPage />
            </AdminGuard>
          }
        />

        <Route
          path="/admin/programs"
          element={
            <AdminGuard>
              <ProgramsPage />
            </AdminGuard>
          }
        />

        <Route
          path="/admin/clients"
          element={
            <AdminGuard>
              <AdminClientsPage />
            </AdminGuard>
          }
        />

        {/* UNKNOWN */}

        <Route
          path="*"
          element={
            profile.role ===
            "admin" ? (
              <Navigate
                to="/admin"
                replace
              />
            ) : (
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

  if (loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return (
      <Routes>
       <Route
  path="/auth"
  element={
    <InstallPrompt>
      <AuthPage />
    </InstallPrompt>
  }
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

  return (
    <AuthenticatedRoutes />
  );
}