import { useContext, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthContext } from "../../contexts/AuthContext";
import { getTransaction, proposePickup, respondToPickup, completeTransaction } from "../../api/transactions";
import "./PickupChoice.css";

function PickupChoice() {
  const { transactionId } = useParams();
  const { user } = useContext(AuthContext);
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [counterMode, setCounterMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    getTransaction(transactionId)
      .then((res) => setTransaction(res.data.data.transaction))
      .catch(() => toast.error("Could not load pickup details."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [transactionId]);

  const idOf = (value) => (value && typeof value === "object" && value._id ? String(value._id) : String(value ?? ""));
  const myRole = transaction && user
    ? (idOf(transaction.donorId) === idOf(user._id) ? "donor" : idOf(transaction.recipientId) === idOf(user._id) ? "recipient" : null)
    : null;
  const pickup = transaction?.pickupDetails;
  const hasPendingProposal = pickup?.status === "proposed";
  const iProposed = hasPendingProposal && pickup.proposedBy === myRole;
  const otherPartyMustRespond = hasPendingProposal && !iProposed;

  const submitPickup = async () => {
    if (!date) return toast.error("Choose a pickup date first.");
    setSubmitting(true);
    try {
      const response = await proposePickup(transactionId, date, note);
      setTransaction(response.data.data.transaction);
      toast.success("Pickup time proposed! The other person has been notified.");
      window.dispatchEvent(new CustomEvent("donation-status-updated"));
      setDate(""); setNote("");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not propose pickup time.");
    } finally {
      setSubmitting(false);
    }
  };

  const respond = async (response) => {
    if (response === "counter" && !date) {
      setCounterMode(true);
      return;
    }
    setSubmitting(true);
    try {
      const result = await respondToPickup(transactionId, response, date, note);
      setTransaction(result.data.data.transaction);
      toast.success(
        response === "accepted" ? "Pickup confirmed!" : response === "rejected" ? "Proposal declined." : "Alternative time proposed."
      );
      window.dispatchEvent(new CustomEvent("donation-status-updated"));
      setDate(""); setNote(""); setCounterMode(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not respond to pickup proposal.");
    } finally {
      setSubmitting(false);
    }
  };

  const markReceived = async () => {
    setSubmitting(true);
    try {
      const response = await completeTransaction(transactionId);
      const completed = response.data.data.transaction;
      setTransaction((current) => current ? {
        ...current,
        status: completed.status,
        completedAt: completed.completedAt,
      } : completed);
      window.dispatchEvent(new CustomEvent("donation-status-updated"));
      toast.success("Donation completed. Thanks for confirming!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not mark as received.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!transaction) return null;

  return (
    <div className="page-narrow">
      <div className="page-header">
        <h1>Self pickup</h1>
        <p>{transaction.itemId?.name} · from {transaction.donorId?.name}</p>
      </div>

      <div className="card card-pad stack gap-md">
        <div className="pickup-location-row">
          <div>
            <strong>📍 Donor location</strong>
            <p className="text-muted">{transaction.donorId?.address}</p>
          </div>
          {transaction.distanceKm != null && (
            <span className="badge badge-info">{transaction.distanceKm} km away</span>
          )}
        </div>

        {transaction.status === "approved" && !hasPendingProposal && myRole === "recipient" && (
          <>
            <h3 className="section-title">Choose a pickup time</h3>
            <p className="text-muted" style={{ marginTop: "-0.6rem" }}>
              Choose a time that works for pickup. The donor can accept, decline, or suggest another time.
            </p>
            <div className="field">
              <label>Pickup date &amp; time</label>
              <input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Note (optional)</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any extra detail" />
            </div>
            <button className="btn btn-block" disabled={!date || submitting} onClick={submitPickup}>
              {submitting ? "Saving..." : "Propose pickup"}
            </button>
          </>
        )}

        {transaction.status === "approved" && !hasPendingProposal && myRole === "donor" && (
          <div className="stack gap-sm">
            <span className="badge badge-warning" style={{ width: "fit-content" }}>Waiting for pickup time</span>
            <p className="text-muted">The recipient will propose a pickup date and time. You can then accept, decline, or suggest a different time.</p>
          </div>
        )}

        {transaction.status === "approved" && iProposed && (
          <div className="stack gap-sm">
            <span className="badge badge-warning" style={{ width: "fit-content" }}>Waiting for a response</span>
            <p>You proposed <strong>{new Date(pickup.scheduledDate).toLocaleString()}</strong></p>
            {pickup.note && <p className="text-muted">{pickup.note}</p>}
          </div>
        )}

        {transaction.status === "approved" && otherPartyMustRespond && !counterMode && (
          <div className="stack gap-sm">
            <h3 className="section-title">Pickup time proposed</h3>
            <p><strong>{new Date(pickup.scheduledDate).toLocaleString()}</strong></p>
            {pickup.note && <p className="text-muted">{pickup.note}</p>}
            <div className="row gap-sm">
              <button className="btn" disabled={submitting} onClick={() => respond("accepted")}>Accept</button>
              <button className="btn btn-outline" disabled={submitting} onClick={() => respond("rejected")}>Decline</button>
              <button className="btn btn-ghost" disabled={submitting} onClick={() => setCounterMode(true)}>Propose different time</button>
            </div>
          </div>
        )}

        {transaction.status === "approved" && otherPartyMustRespond && counterMode && (
          <div className="stack gap-sm">
            <h3 className="section-title">Propose a different time</h3>
            <div className="field">
              <label>Pickup date &amp; time</label>
              <input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="row gap-sm">
              <button className="btn" disabled={!date || submitting} onClick={() => respond("counter")}>Send counter-proposal</button>
              <button className="btn btn-ghost" onClick={() => setCounterMode(false)}>Cancel</button>
            </div>
          </div>
        )}

        {transaction.status === "pickup_arranged" && (
          <div className="stack gap-sm">
            <span className="badge badge-success" style={{ width: "fit-content" }}>Pickup arranged</span>
            <p>Scheduled for <strong>{new Date(pickup.scheduledDate).toLocaleString()}</strong></p>
            <p className="text-muted">{pickup.address}</p>
            {myRole === "recipient" && (
              <>
                <p>The donation is not complete until the item has been handed over. After pickup, confirm receipt below.</p>
                <button className="btn btn-block" disabled={submitting} onClick={markReceived}>
                  {submitting ? "Completing..." : "Confirm donation received"}
                </button>
              </>
            )}
            {myRole === "donor" && <p className="text-muted">Next: complete the handover at the scheduled time. The donation will be marked complete when the recipient confirms receipt.</p>}
          </div>
        )}

        {transaction.status === "completed" && (
          <div className="empty-state">
            <h3>Donation completed</h3>
            <p>{transaction.itemId?.name} has been marked as received. Thank you for helping your community.</p>
          </div>
        )}

        <Link to={`/transactions/${transactionId}/chat`} className="text-muted text-center">← Back to chat</Link>
      </div>
    </div>
  );
}

export default PickupChoice;
