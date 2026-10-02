import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getPendingApprovals, respondToTransaction } from "../../api/transactions";
import "./Approvals.css";

function Approvals() {
  const [incomingRequests, setIncomingRequests] = useState([]); // others requested your donations
  const [incomingOffers, setIncomingOffers] = useState([]); // others offered help on your requests
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actingId, setActingId] = useState(null);

  const fetchAll = () => {
    setLoading(true);
    setError(false);
    getPendingApprovals()
      .then((res) => {
        const data = res.data.data;
        setIncomingRequests(data.incomingRequests || []);
        setIncomingOffers(data.incomingOffers || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const respond = async (transactionId, response, isOffer) => {
    setActingId(transactionId);
    try {
      await respondToTransaction(transactionId, response);
      toast.success(response === "approved" ? "Match approved!" : "Declined.");
      if (isOffer) {
        setIncomingOffers((prev) => prev.filter((t) => t._id !== transactionId));
      } else {
        setIncomingRequests((prev) => prev.filter((t) => t._id !== transactionId));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong.");
    } finally {
      setActingId(null);
    }
  };

  const nothingPending = incomingRequests.length === 0 && incomingOffers.length === 0;

  return (
    <div className="page-narrow">
      <div className="page-header">
        <h1>Requests &amp; offers</h1>
        <p>Approve incoming requests for your donations, or accept offers people have made on your requests.</p>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="empty-state">
          <h3>Unable to load approvals</h3>
          <p>Something went wrong - please try again shortly.</p>
        </div>
      ) : nothingPending ? (
        <div className="empty-state">
          <h3>Nothing pending</h3>
          <p>When someone requests your donation, or offers help on your request, it'll show up here.</p>
        </div>
      ) : (
        <>
          {incomingRequests.length > 0 && (
            <>
              <h2 className="section-title">People who want your donations</h2>
              <div className="stack gap-md" style={{ marginBottom: "2rem" }}>
                {incomingRequests.map((t) => (
                  <div key={t._id} className="card card-pad approval-row">
                    <img src={t.itemId?.imageUrl?.[0] || "/donationItems.jpg"} alt={t.itemId?.name} />
                    <div className="stack gap-xs" style={{ flex: 1 }}>
                      <strong>{t.recipientId?.name}</strong>
                      <span className="text-muted">wants your "{t.itemId?.name}"</span>
                      <span className="text-muted" style={{ fontSize: "0.8rem" }}>{t.recipientId?.address}</span>
                    </div>
                    <div className="row gap-sm">
                      <button className="btn btn-sm" disabled={actingId === t._id} onClick={() => respond(t._id, "approved", false)}>Approve</button>
                      <button className="btn btn-sm btn-outline" disabled={actingId === t._id} onClick={() => respond(t._id, "rejected", false)}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {incomingOffers.length > 0 && (
            <>
              <h2 className="section-title">Offers on your requests</h2>
              <div className="stack gap-md">
                {incomingOffers.map((t) => (
                  <div key={t._id} className="card card-pad approval-row">
                    <img src={t.itemId?.imageUrl?.[0] || "/donationItems.jpg"} alt={t.itemId?.name} />
                    <div className="stack gap-xs" style={{ flex: 1 }}>
                      <strong>{t.donorId?.name}</strong>
                      <span className="text-muted">offered "{t.itemId?.name}" for your request</span>
                      <span className="text-muted" style={{ fontSize: "0.8rem" }}>{t.donorId?.address}</span>
                    </div>
                    <div className="row gap-sm">
                      <button className="btn btn-sm" disabled={actingId === t._id} onClick={() => respond(t._id, "approved", true)}>Accept</button>
                      <button className="btn btn-sm btn-outline" disabled={actingId === t._id} onClick={() => respond(t._id, "rejected", true)}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Approvals;
