import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createDonation } from "../../api/donations";
import CategorySelector from "../../components/CategorySelector/CategorySelector";
import "./DonationForm.css";

const CONDITIONS = [
  { value: "new", description: "Brand new, never used" },
  { value: "like_new", description: "Barely used, excellent condition" },
  { value: "used", description: "Noticeable wear, still functional" },
];

// Reads a File as a data: URI so the first photo can be sent to the AI
// image-classification endpoint alongside the text description (spec #29)
// without needing a separate "upload, then classify" round trip through
// Cloudinary first.
const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function DonationForm() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState(null); // { categoryId, categoryName, categorySource, categoryConfidence }
  const [firstImageDataUrl, setFirstImageDataUrl] = useState(null);
  const [formData, setFormData] = useState({
    name: "", description: "", quantity: 1, condition: "new", images: [], previews: [],
  });

  const handleImageSelect = async (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setFormData((prev) => {
      const images = [...prev.images];
      const previews = [...prev.previews];
      images[index] = file;
      previews[index] = previewUrl;
      return { ...prev, images, previews };
    });
    if (index === 0) {
      try {
        setFirstImageDataUrl(await readAsDataUrl(file));
      } catch {
        // Image-assisted suggestion is optional - text alone still works.
      }
    }
  };

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
    const data = new FormData();
    data.append("name", formData.name);
    data.append("categoryId", category.categoryId);
    data.append("categorySource", category.categorySource);
    if (category.categoryConfidence != null) data.append("categoryConfidence", category.categoryConfidence);
    data.append("description", formData.description);
    data.append("quantity", formData.quantity);
    data.append("condition", formData.condition);
    formData.images.filter(Boolean).forEach((img) => data.append("images", img));

    try {
      await createDonation(data);
      toast.success("Donation posted! We'll notify matching requesters.");
      navigate("/my-donations");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create donation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-narrow">
      <div className="page-header">
        <h1>Donate an item</h1>
        <p>Share something you no longer need with someone who could use it.</p>
      </div>

      <form onSubmit={handleSubmit} className="form-card stack">
        <div className="field">
          <label>Item name*</label>
          <input className="input" name="name" required placeholder="E.g., Winter jacket, Children's books" value={formData.name} onChange={handleChange} />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea className="input" name="description" placeholder="Size, color, brand, any details that'll help - this also helps us suggest a category" value={formData.description} onChange={handleChange} />
        </div>

        <div className="form-grid">
          <CategorySelector
            itemText={`${formData.name} ${formData.description}`}
            imageDataUrl={firstImageDataUrl}
            value={category}
            onChange={setCategory}
          />
          <div className="field">
            <label>Quantity*</label>
            <input className="input" type="number" min={1} name="quantity" required value={formData.quantity} onChange={handleChange} />
          </div>
        </div>

        <div className="field">
          <label>Condition*</label>
          <div className="grid grid-3">
            {CONDITIONS.map((c) => (
              <div
                key={c.value}
                onClick={() => setFormData((p) => ({ ...p, condition: c.value }))}
                className={`card card-pad condition-tile ${formData.condition === c.value ? "selected" : ""}`}
              >
                <strong>{c.value}</strong>
                <span>{c.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Photos <span className="hint">up to 3 — clear photos get matched faster, and the first one helps AI suggest a category</span></label>
          <div className="row gap-sm">
            {[0, 1, 2].map((index) => (
              <label key={index} className="image-upload-box">
                <input type="file" accept="image/*" hidden onChange={(e) => handleImageSelect(e, index)} />
                {formData.previews[index] ? <img src={formData.previews[index]} alt={`Preview ${index + 1}`} /> : <span>+</span>}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="btn btn-block">
          {isSubmitting ? "Posting..." : "Post donation"}
        </button>
      </form>
    </div>
  );
}

export default DonationForm;
