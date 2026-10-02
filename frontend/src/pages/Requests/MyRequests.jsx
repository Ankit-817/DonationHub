import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyRequests } from "../../api/requests";
import "./Requests.css";

const URGENCY_TONE = { low: "neutral", medium: "warning", high: "danger" };

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(false);

  useEffect(() => {
    getMyRequests()
      .then((res) => setRequests(res.data.data.requests || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header row-between wrap gap-md">
        <div>
          <h1>My requests</h1>
          <p>Items you've asked the community for.</p>
        </div>
        <Link to="/requests/new" className="btn btn-accent">+ Request an item</Link>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="empty-state">
          <h3>Unable to load your requests</h3>
          <p>Something went wrong - please try again shortly.</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <h3>You haven't posted any requests yet</h3>
          <p>Let the community know what you need.</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {requests.map((request) => (
            <div key={request._id} className="card card-pad request-card">
              <div className="row-between">
                <span className="badge badge-neutral">{request.itemType?.replace("_", " ")}</span>
                <span className={`badge badge-${request.isCompleted ? "success" : URGENCY_TONE[request.urgency] || "neutral"}`}>
                  {request.isCompleted ? "fulfilled" : `${request.urgency} urgency`}
                </span>
              </div>
              <h3>{request.description?.slice(0, 80) || "No description"}</h3>
              <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                {request.fulfilledQuantity || 0} / {request.quantity} fulfilled
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyRequests;
