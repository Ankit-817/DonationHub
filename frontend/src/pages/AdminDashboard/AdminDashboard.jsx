import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../../api/client";
import "./AdminDashboard.css";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadUsers = () => api.get("/api/admin/users", { params: { search } }).then((res) => setUsers(res.data.data.users || []));

  useEffect(() => {
    Promise.all([api.get("/api/admin/stats"), loadUsers()])
      .then(([statsRes]) => setStats(statsRes.data.data))
      .catch(() => toast.error("Could not load admin data."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadUsers(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleBan = async (u) => {
    try {
      await api.patch(`/api/admin/users/${u._id}/ban`, { isBanned: !u.isBanned });
      setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, isBanned: !u.isBanned } : x)));
      toast.success(u.isBanned ? "User unbanned" : "User banned");
    } catch (error) {
      toast.error(error.response?.data?.message || "Action failed.");
    }
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header"><h1>Admin</h1><p>Basic moderation only - no fundraiser/NGO management.</p></div>

      {stats && (
        <div className="grid grid-4" style={{ marginBottom: "2rem" }}>
          <div className="card card-pad"><strong>{stats.totalUsers}</strong><p className="text-muted">Users</p></div>
          <div className="card card-pad"><strong>{stats.totalDonations}</strong><p className="text-muted">Donations</p></div>
          <div className="card card-pad"><strong>{stats.completedTransactions}</strong><p className="text-muted">Completed</p></div>
          <div className="card card-pad"><strong>{stats.bannedUsers}</strong><p className="text-muted">Banned</p></div>
        </div>
      )}

      <h2 className="section-title">Users</h2>
      <input className="input" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: "1rem" }} />
      <div className="stack gap-sm">
        {users.map((u) => (
          <div key={u._id} className="card card-pad row-between">
            <div>
              <strong>{u.name}</strong> <span className="text-muted">({u.email})</span>
              {u.isBanned && <span className="badge badge-danger" style={{ marginLeft: "0.5rem" }}>Banned</span>}
            </div>
            {!u.isAdmin && (
              <button className={`btn btn-sm ${u.isBanned ? "" : "btn-danger"}`} onClick={() => toggleBan(u)}>
                {u.isBanned ? "Unban" : "Ban"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboard;
