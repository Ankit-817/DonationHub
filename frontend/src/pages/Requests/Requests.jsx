import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRequests } from "../../api/requests";
import "./Requests.css";

const URGENCY_TONE = { low: "neutral", medium: "warning", high: "danger" };

function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);

  useEffect(() => {
    getRequests()
      .then((res) => setRequests(res.data.data.requests || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header row-between wrap gap-md">
        <div>
          <h1>Browse requests</h1>
          <p>People in the community asking for items you might be able to donate.</p>
        </div>
        <Link to="/requests/new" className="btn btn-accent">+ Request an item</Link>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="empty-state">
          <h3>Unable to load requests</h3>
          <p>Something went wrong - please try again shortly.</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <h3>No open requests right now</h3>
          <p>Check back soon, or post a donation and we'll match it automatically.</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {requests.map((request) => (
            <div key={request._id} className="card card-pad request-card">
              <div className="row-between">
                <span className="badge badge-neutral">{request.itemType?.replace("_", " ")}</span>
                <span className={`badge badge-${URGENCY_TONE[request.urgency] || "neutral"}`}>{request.urgency} urgency</span>
              </div>
              <h3>{request.description?.slice(0, 80) || "No description"}</h3>
              <p className="text-muted">Requested by {request.userId?.name || "a community member"}</p>
              <div className="row gap-sm text-muted" style={{ fontSize: "0.85rem" }}>
                <span>Qty: {request.quantity}</span>
                <span>·</span>
                <span>Condition: {request.condition}</span>
              </div>
              <Link to={`/requests/${request._id}/offer`} className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: "0.4rem" }}>
                Offer to help
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Requests;
