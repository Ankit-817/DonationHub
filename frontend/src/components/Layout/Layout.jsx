import { useContext, useEffect, useState, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { getNotifications } from "../../api/notifications";
import { getPendingApprovals } from "../../api/transactions";
import "./Layout.css";

const NAV_LINKS = [
  { to: "/home", label: "Home", end: true },
  { to: "/donations", label: "Donations" },
  { to: "/requests", label: "Requests" },
  { to: "/chat", label: "Chat" },
];

function Logo() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 10c-2.21 0-4-1.79-4-4h2c0 1.1.9 2 2 2s2-.9 2-2h2c0 2.21-1.79 4-4 4z" />
    </svg>
  );
}

function Layout() {
  const { user, isAdmin, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const profileRef = useRef(null);

  // Header badges are plain REST polling - Socket.IO is reserved for chat
  // only (see contexts/SocketContext.jsx and backend/src/socket.js).
  const fetchBadges = async () => {
    try {
      const [notifRes, approvalsRes] = await Promise.all([getNotifications(), getPendingApprovals()]);
      const unread = (notifRes.data?.data?.notifications || []).filter((n) => n.status === "unread").length;
      const approvals = approvalsRes.data?.data || { incomingRequests: [], incomingOffers: [] };
      setUnreadNotifications(unread);
      setPendingApprovals(approvals.incomingRequests.length + approvals.incomingOffers.length);
    } catch {
      // Non-fatal - header badges are a nice-to-have.
    }
  };

  useEffect(() => {
    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/home" className="brand">
            <Logo />
            <span>Donation Hub</span>
          </NavLink>

          <nav className={`main-nav ${menuOpen ? "open" : ""}`}>
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `main-nav-link ${isActive ? "active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `main-nav-link admin-link ${isActive ? "active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                Admin
              </NavLink>
            )}
          </nav>

          <div className="header-actions">
            <NavLink to="/notifications" className="icon-btn" title="Notifications">
              <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
              {unreadNotifications > 0 && <span className="badge-dot">{unreadNotifications}</span>}
            </NavLink>

            <div className="profile-menu" ref={profileRef}>
              <button className="avatar-btn" onClick={() => setProfileOpen((v) => !v)}>
                <span className="avatar-circle">{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
                {pendingApprovals > 0 && <span className="badge-dot small">{pendingApprovals}</span>}
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <strong>{user?.name}</strong>
                    <span>{user?.email}</span>
                  </div>
                  <NavLink to="/profile" onClick={() => setProfileOpen(false)}>My Profile</NavLink>
                  <NavLink to="/my-donations" onClick={() => setProfileOpen(false)}>My Donations</NavLink>
                  <NavLink to="/my-requests" onClick={() => setProfileOpen(false)}>My Requests</NavLink>
                  <NavLink to="/approvals" onClick={() => setProfileOpen(false)}>
                    Requests &amp; offers {pendingApprovals > 0 && <span className="chip">{pendingApprovals}</span>}
                  </NavLink>
                  <button className="logout-btn" onClick={handleLogout}>Log out</button>
                </div>
              )}
            </div>

            <button className="hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet context={{ refreshBadges: fetchBadges }} />
      </main>

      <footer className="app-footer">
        <div className="footer-logo"><Logo /> Donation Hub</div>
        <p>Give what you can. Help someone nearby.</p>
      </footer>
    </div>
  );
}

export default Layout;
