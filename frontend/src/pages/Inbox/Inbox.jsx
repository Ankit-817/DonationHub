import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { getMyTransactions } from "../../api/transactions";
import "./Inbox.css";

const STATUS_LABEL = {
  requested: "Awaiting donor approval",
  offered: "Awaiting requester's response",
  rejected: "Declined",
  approved: "Choose a pickup method",
  pickup_arranged: "Pickup arranged",
  completed: "Completed",
  cancelled: "Cancelled",
};

function Inbox() {
  const { user } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);

  useEffect(() => {
    getMyTransactions()
      .then((res) => setTransactions(res.data.data.transactions || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const chatReady = transactions.filter((t) => ["approved", "pickup_arranged", "completed"].includes(t.status));
  const waiting = transactions.filter((t) => ["requested", "offered", "rejected"].includes(t.status));

  return (
    <div className="page-narrow">
      <div className="page-header">
        <h1>Chat</h1>
        <p>Conversations unlock once a donor approves a request.</p>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="empty-state">
          <h3>Unable to load your conversations</h3>
          <p>Something went wrong - please try again shortly.</p>
        </div>
      ) : (
        <>
          {chatReady.length === 0 && waiting.length === 0 && (
            <div className="empty-state">
              <h3>No conversations yet</h3>
              <p>Request a donation, or approve an incoming request, to start chatting.</p>
            </div>
          )}

          <div className="stack gap-sm">
            {chatReady.map((t) => {
              const other = t.donorId?._id === user?._id ? t.recipientId : t.donorId;
              return (
                <Link to={`/transactions/${t._id}/chat`} key={t._id} className="card card-pad inbox-row">
                  <span className="avatar-circle">{other?.name?.charAt(0)?.toUpperCase() || "?"}</span>
                  <div className="stack" style={{ flex: 1 }}>
                    <strong>{other?.name}</strong>
                    <span className="text-muted">{t.itemId?.name}</span>
                  </div>
                  <span className={`badge ${t.status === "completed" ? "badge-success" : "badge-info"}`}>{STATUS_LABEL[t.status]}</span>
                </Link>
              );
            })}
          </div>

          {waiting.length > 0 && (
            <>
              <h2 className="section-title" style={{ marginTop: "2rem" }}>Pending</h2>
              <div className="stack gap-sm">
                {waiting.map((t) => {
                  const other = t.donorId?._id === user?._id ? t.recipientId : t.donorId;
                  return (
                    <div key={t._id} className="card card-pad inbox-row" style={{ opacity: 0.7 }}>
                      <span className="avatar-circle">{other?.name?.charAt(0)?.toUpperCase() || "?"}</span>
                      <div className="stack" style={{ flex: 1 }}>
                        <strong>{other?.name}</strong>
                        <span className="text-muted">{t.itemId?.name}</span>
                      </div>
                      <span className={`badge ${t.status === "rejected" ? "badge-danger" : "badge-warning"}`}>{STATUS_LABEL[t.status]}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Inbox;
