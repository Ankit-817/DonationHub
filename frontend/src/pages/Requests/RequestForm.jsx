import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createRequest } from "../../api/requests";
import CategorySelector from "../../components/CategorySelector/CategorySelector";

function RequestForm() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState(null); // { categoryId, categoryName, categorySource, categoryConfidence }
  const [formData, setFormData] = useState({
    description: "", quantity: 1, condition: "any", urgency: "medium",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category?.categoryId) {
      toast.error("Please choose or create a category first.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createRequest({ ...formData, ...category });
      toast.success("Request posted! We'll notify matching donors nearby.");
      navigate("/my-requests");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-narrow">
      <div className="page-header">
        <h1>Request an item</h1>
        <p>Tell the community what you need — we'll match it against nearby donations automatically.</p>
      </div>

      <form onSubmit={handleSubmit} className="form-card stack">
        <div className="field">
          <label>What do you need?*</label>
          <textarea
            className="input"
            name="description"
            required
            placeholder="E.g., 'Something I can use to study at home' or 'A basic laptop for online classes'"
            value={formData.description}
            onChange={handleChange}
          />
          <span className="hint">Describe it in your own words - we'll suggest a category and find relevant donations automatically.</span>
        </div>

        <div className="form-grid">
          <CategorySelector itemText={formData.description} value={category} onChange={setCategory} />
          <div className="field">
            <label>Quantity needed*</label>
            <input className="input" type="number" min={1} name="quantity" required value={formData.quantity} onChange={handleChange} />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Preferred condition</label>
            <select className="input" name="condition" value={formData.condition} onChange={handleChange}>
              <option value="any">Any condition</option>
              <option value="used">Used is fine</option>
              <option value="new">New only</option>
            </select>
          </div>
          <div className="field">
            <label>Urgency</label>
            <select className="input" name="urgency" value={formData.urgency} onChange={handleChange}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="btn btn-block">
          {isSubmitting ? "Posting..." : "Post request"}
        </button>
      </form>
    </div>
  );
}

export default RequestForm;
