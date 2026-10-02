import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getRequests } from "../../api/requests";
import { getCategories } from "../../api/categories";
import { getMyDonations, createDonation } from "../../api/donations";
import { offerHelp as offerHelpRequest } from "../../api/transactions";
import "./OfferHelp.css";
import "../Donations/DonationForm.css";

const CONDITIONS = ["new", "like_new", "used"];

function OfferHelp() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [donations, setDonations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ name: "", description: "", quantity: 1, condition: "used", images: [], previews: [] });

  useEffect(() => {
    Promise.all([getRequests(), getMyDonations()])
      .then(([reqRes, donRes]) => {
        const found = (reqRes.data.data.requests || []).find((r) => r._id === requestId);
        setRequest(found || null);
        setDonations((donRes.data.data.donations || []).filter((d) => d.status === "pending"));
      })
      .catch(() => toast.error("Could not load this request."))
      .finally(() => setLoading(false));
  }, [requestId]);

  const matching = useMemo(
    () => donations.filter((d) => d.itemId?.category === request?.itemType),
    [donations, request]
  );
  const others = useMemo(
    () => donations.filter((d) => d.itemId?.category !== request?.itemType),
    [donations, request]
  );

  const sendOffer = async (donationId) => {
    setSubmitting(true);
    try {
      await offerHelpRequest({ requestId, donationId });
      toast.success("Offer sent! You'll be notified once they respond.");
      navigate("/my-donations");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send offer.");
      setSubmitting(false);
    }
  };

  const useExistingItem = () => {
    if (!selectedId) return toast.error("Pick an item to offer first.");
    sendOffer(selectedId);
  };

  const handleImageSelect = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => {
      const images = [...prev.images];
      const previews = [...prev.previews];
      images[index] = file;
      previews[index] = previewUrl;
      return { ...prev, images, previews };
    });
  };

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const donateAndOffer = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Give the item a name.");
    setSubmitting(true);
    try {
      let categoryId = request.categoryId;
      if (!categoryId) {
        const categoriesRes = await getCategories();
        const matchingCategory = (categoriesRes.data.data.categories || []).find(
          (category) => category.name.trim().toLowerCase() === request.itemType.trim().toLowerCase()
        );
        categoryId = matchingCategory?._id;
      }
      if (!categoryId) {
        throw new Error("This request's category is no longer available. Choose an existing donation instead.");
      }

      const data = new FormData();
      data.append("name", form.name);
      data.append("categoryId", categoryId);
      data.append("description", form.description);
      data.append("quantity", form.quantity);
      data.append("condition", form.condition);
      form.images.filter(Boolean).forEach((img) => data.append("images", img));

      const { data: donationRes } = await createDonation(data);
      await sendOffer(donationRes.data.donation._id);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not donate this item.");
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!request) return <div className="page empty-state"><h3>Request not found</h3></div>;

  return (
    <div className="page-narrow">
      <div className="page-header">
        <h1>Offer to help</h1>
        <p>
          {request.userId?.name || "Someone"} needs <strong>{request.itemType?.replace("_", " ")}</strong>
          {request.description && <> - "{request.description}"</>}
        </p>
      </div>

      {(matching.length > 0 || others.length > 0) && (
        <div className="card card-pad stack gap-md" style={{ marginBottom: "1.5rem" }}>
          <h3 className="section-title">Offer something you've already listed</h3>
          {matching.length > 0 && (
            <div>
              <span className="text-muted" style={{ fontSize: "0.85rem" }}>Matches this request</span>
              <div className="grid grid-3" style={{ marginTop: "0.5rem" }}>
                {matching.map((d) => (
                  <div key={d._id} className={`card card-pad offer-tile ${selectedId === d._id ? "selected" : ""}`} onClick={() => setSelectedId(d._id)}>
                    <img src={d.itemId?.imageUrl?.[0] || "/donationItems.jpg"} alt={d.itemId?.name} />
                    <strong>{d.itemId?.name}</strong>
                    <span className="text-muted">{d.itemId?.condition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {others.length > 0 && (
            <div>
              <span className="text-muted" style={{ fontSize: "0.85rem" }}>Your other available items</span>
              <div className="grid grid-3" style={{ marginTop: "0.5rem" }}>
                {others.map((d) => (
                  <div key={d._id} className={`card card-pad offer-tile ${selectedId === d._id ? "selected" : ""}`} onClick={() => setSelectedId(d._id)}>
                    <img src={d.itemId?.imageUrl?.[0] || "/donationItems.jpg"} alt={d.itemId?.name} />
                    <strong>{d.itemId?.name}</strong>
                    <span className="text-muted">{d.itemId?.condition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button className="btn btn-block" disabled={!selectedId || submitting} onClick={useExistingItem}>
            {submitting ? "Sending offer..." : "Offer this item"}
          </button>
        </div>
      )}

      <div className="card card-pad">
        <h3 className="section-title">
          {matching.length > 0 || others.length > 0 ? "Or donate a new item for this request" : "Donate an item for this request"}
        </h3>
        <p className="text-muted" style={{ marginTop: "-0.6rem", marginBottom: "1rem" }}>
          No need to list it separately first - fill this in and it goes straight to {request.userId?.name || "the requester"} as an offer.
        </p>

        <form onSubmit={donateAndOffer} className="stack">
          <div className="field">
            <label>Item name*</label>
            <input className="input" name="name" required placeholder={`E.g., ${request.itemType?.replace("_", " ")}`} value={form.name} onChange={handleChange} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Category</label>
              <input className="input" value={request.itemType?.replace("_", " ")} disabled />
            </div>
            <div className="field">
              <label>Quantity*</label>
              <input className="input" type="number" min={1} name="quantity" required value={form.quantity} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label>Condition*</label>
            <select className="input" name="condition" value={form.condition} onChange={handleChange}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Description</label>
            <textarea className="input" name="description" placeholder="Size, color, brand, any details that'll help" value={form.description} onChange={handleChange} />
          </div>

          <div className="field">
            <label>Photos <span className="hint">optional, up to 3</span></label>
            <div className="row gap-sm">
              {[0, 1, 2].map((index) => (
                <label key={index} className="image-upload-box">
                  <input type="file" accept="image/*" hidden onChange={(e) => handleImageSelect(e, index)} />
                  {form.previews[index] ? <img src={form.previews[index]} alt={`Preview ${index + 1}`} /> : <span>+</span>}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-accent btn-block" disabled={submitting}>
            {submitting ? "Sending..." : "Donate this item & send offer"}
          </button>
        </form>
      </div>

      <p className="text-center" style={{ marginTop: "1.5rem" }}>
        <Link to="/requests" className="text-muted">← Back to requests</Link>
      </p>
    </div>
  );
}

export default OfferHelp;
