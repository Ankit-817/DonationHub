import { useEffect, useState } from "react";
import { getImpact } from "../../api/impact";
import "./Impact.css";

function Impact() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  const loadImpact = async () => {
    try {
      const res = await getImpact();
      setStats(res.data.data);
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    loadImpact();

    const handleDonationStatusUpdated = () => loadImpact();
    window.addEventListener("donation-status-updated", handleDonationStatusUpdated);

    return () => {
      window.removeEventListener("donation-status-updated", handleDonationStatusUpdated);
    };
  }, []);

  return (
    <section id="impact" className="impact">
      <h2>Our impact so far</h2>
      <p>Real numbers, straight from completed donations - nothing estimated.</p>
      {error ? (
        <p className="text-muted">Unable to load impact stats right now.</p>
      ) : (
        <div className="stats">
          <div className="stat">
            <div className="stat-number">{stats ? stats.successfulDonations.toLocaleString() : "—"}</div>
            <div className="stat-text">Successful Donations</div>
          </div>
          <div className="stat">
            <div className="stat-number">{stats ? stats.peopleHelped.toLocaleString() : "—"}</div>
            <div className="stat-text">People Helped</div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Impact;
