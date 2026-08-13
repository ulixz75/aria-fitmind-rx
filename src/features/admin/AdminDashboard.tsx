import { useEffect, useState } from "react";
import { Clock3, UserCheck, UserX, Shield } from "lucide-react";
import { listUsers } from "../../services/firestore";
import type { UserDoc } from "../../types/models";
export function AdminDashboard() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  useEffect(() => {
    void listUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);
  const pending = users.filter((u) => u.status === "pending").length;
  const active = users.filter((u) => u.status === "active").length;
  const suspended = users.filter((u) => u.status === "suspended").length;
  return (
    <div className="dashboard">
      <div className="page-title">
        <span className="eyebrow">Admin portal</span>
        <h1>ARIA control center.</h1>
        <p className="muted">
          Approve clients, manage access and prepare the coaching system.
        </p>
      </div>
      <section className="stats-grid">
        <article className="stat-card">
          <Clock3 size={18} />
          <span>Pending</span>
          <strong>{pending}</strong>
        </article>
        <article className="stat-card">
          <UserCheck size={18} />
          <span>Active</span>
          <strong>{active}</strong>
        </article>
        <article className="stat-card">
          <UserX size={18} />
          <span>Suspended</span>
          <strong>{suspended}</strong>
        </article>
      </section>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">System</span>
            <h2>Admin capabilities</h2>
          </div>
          <Shield size={22} />
        </div>
        <div className="feature-grid">
          <div>
            <strong>Users</strong>
            <span>Approve, suspend, reactivate, delete profile.</span>
          </div>
          <div>
            <strong>Client profiles</strong>
            <span>Review training information.</span>
          </div>
          <div>
            <strong>ARIA instructions</strong>
            <span>Global coach prompt placeholder.</span>
          </div>
          <div>
            <strong>Activity</strong>
            <span>Usage metrics placeholder.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
