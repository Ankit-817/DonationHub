import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getDonation } from "../../api/donations";
import { createTransaction } from "../../api/transactions";
import "./RequestDonation.css";

function RequestDonation() {
  const { donationId } = useParams();
  const navigate = useNavigate();
  const [donation, setDonation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    getDonation(donationId)
      .then((res) => setDonation(res.data.data.donation))
      .catch(() => toast.error("Could not load this donation."))
      .finally(() => setLoading(false));
  }, [donationId]);

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await createTransaction({
        donorId: donation.donorId._id,
        itemId: donation.itemId._id,
        donationId: donation._id,
      });

      toast.success("Request sent! You'll be notified once the donor responds.");
      navigate("/approvals");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send request.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!donation) return <div className="page empty-state"><h3>Donation not found</h3></div>;

  return (
    <div className="page-narrow">
      <div className="card request-donation-card">
        <img src={donation.itemId?.imageUrl?.[0] || "/donationItems.jpg"} alt={donation.itemId?.name} />
        <div className="card-pad stack gap-sm">
          <span className="badge badge-neutral">{donation.itemId?.category?.replace("_", " ")}</span>
          <h1>{donation.itemId?.name}</h1>
          <p className="text-muted">{donation.itemId?.description || "No description provided."}</p>
          <div className="row gap-md text-muted" style={{ fontSize: "0.9rem" }}>
            <span>Condition: <strong>{donation.itemId?.condition}</strong></span>
            <span>Quantity: <strong>{donation.itemId?.quantity}</strong></span>
          </div>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>
            Donated by {donation.donorId?.name}. Sending a request notifies the donor - they'll need to approve it
            before you can chat and arrange pickup.
          </p>
          <button className="btn btn-block" disabled={requesting} onClick={handleRequest}>
            {requesting ? "Sending request..." : "Request this item"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RequestDonation;
