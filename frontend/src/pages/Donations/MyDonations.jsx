import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyDonations } from "../../api/donations";
import "./Donations.css";

const STATUS_TONE = { pending: "warning", matched: "info", completed: "success", cancelled: "neutral" };

function MyDonations() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDonations = () => {
    getMyDonations()
      .then((res) => setDonations(res.data.data.donations || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDonations();

    const handleDonationStatusUpdated = () => loadDonations();
    window.addEventListener("donation-status-updated", handleDonationStatusUpdated);

    return () => {
      window.removeEventListener("donation-status-updated", handleDonationStatusUpdated);
    };
  }, []);

  return (
    <div className="page">
      <div className="page-header row-between wrap gap-md">
        <div>
          <h1>My donations</h1>
          <p>Items you've listed and their current status.</p>
        </div>
        <Link to="/donations/new" className="btn btn-accent">+ Donate an item</Link>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="empty-state">
          <h3>Unable to load your donations</h3>
          <p>Something went wrong - please try again shortly.</p>
        </div>
      ) : donations.length === 0 ? (
        <div className="empty-state">
          <h3>You haven't donated anything yet</h3>
          <p>List your first item and help someone in your community.</p>
        </div>
      ) : (
        <div className="grid grid-3 donations-grid">
          {donations.map((donation) => (
            <div key={donation._id} className="card donation-card">
              <img className="donation-image" src={donation.itemId?.imageUrl?.[0] || "/donationItems.jpg"} alt={donation.itemId?.name} />
              <div className="card-pad stack gap-xs">
                <div className="row-between">
                  <h3>{donation.itemId?.name}</h3>
                  <span className={`badge badge-${STATUS_TONE[donation.status] || "neutral"}`}>{donation.status}</span>
                </div>
                <p className="text-muted">{donation.itemId?.description}</p>
                <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                  Listed {new Date(donation.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyDonations;
