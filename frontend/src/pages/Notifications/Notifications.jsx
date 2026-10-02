import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getNotifications, markNotificationRead, deleteNotification } from "../../api/notifications";
import "./Notifications.css";

const CHAT_LINKED_TYPES = ["pickup_proposal", "transaction_response", "transaction_completed", "transaction_request"];

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    getNotifications()
      .then((res) => setNotifications(res.data.data.notifications || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, status: "read" } : n)));
  };

  const remove = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n._id !== id));
  };

  const unread = notifications.filter((n) => n.status === "unread");
  const read = notifications.filter((n) => n.status === "read");

  const renderRow = (n) => (
    <Link
      to={CHAT_LINKED_TYPES.includes(n.type) && n.transactionId ? `/transactions/${n.transactionId}/chat` : "#"}
      key={n._id}
      className={`card card-pad notif-row ${n.status === "unread" ? "unread" : ""}`}
      onClick={() => n.status === "unread" && markRead(n._id)}
    >
      <p>{n.message}</p>
      <div className="row-between">
        <span className="text-muted" style={{ fontSize: "0.78rem" }}>{new Date(n.createdAt).toLocaleString()}</span>
        <button className="btn btn-ghost btn-sm" onClick={(e) => remove(n._id, e)}>Delete</button>
      </div>
    </Link>
  );

  return (
    <div className="page-narrow">
      <div className="page-header"><h1>Notifications</h1></div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="empty-state"><h3>Unable to load notifications</h3><p>Please try again shortly.</p></div>
      ) : notifications.length === 0 ? (
        <div className="empty-state"><h3>You're all caught up</h3></div>
      ) : (
        <>
          {unread.length > 0 && (
            <>
              <h2 className="section-title">Unread</h2>
              <div className="stack gap-sm" style={{ marginBottom: "1.5rem" }}>{unread.map(renderRow)}</div>
            </>
          )}
          {read.length > 0 && (
            <>
              <h2 className="section-title">Read</h2>
              <div className="stack gap-sm">{read.map(renderRow)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Notifications;
