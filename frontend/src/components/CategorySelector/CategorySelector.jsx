import { useEffect, useRef, useState } from "react";
import { createCategory, getCategories, suggestCategory } from "../../api/categories";
import "./CategorySelector.css";

// Categories are NEVER a hardcoded list in this component - they're always
// fetched from the backend (spec #18), and the AI suggestion is always
// presented as something the user accepts/overrides, never auto-applied
// (spec #31: "AI must recommend, not control").
//
// Props:
//   itemText    free text (name + description, or the request description)
//               the suggestion is based on. Debounced automatically.
//   imageDataUrl optional data: URI of an uploaded photo, for combined
//               text+image classification (spec #29).
//   value       { categoryId, categoryName } currently selected, or null
//   onChange(payload: { categoryId, categoryName, categorySource, categoryConfidence })
function CategorySelector({ itemText, imageDataUrl, value, onChange, label = "Category*" }) {
  const [categories, setCategories] = useState([]);
  const [suggestion, setSuggestion] = useState(null); // API response for the current text/image
  const [aiAvailable, setAiAvailable] = useState(true);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.data.data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    clearTimeout(debounceRef.current);
    const text = (itemText || "").trim();
    if (text.length < 3 && !imageDataUrl) {
      setSuggestion(null);
      setAiAvailable(true);
      setLoadingSuggestion(false);
      return () => {
        active = false;
      };
    }
    setDismissedSuggestion(false);
    setSuggestion(null);
    debounceRef.current = setTimeout(async () => {
      if (!active) return;
      setLoadingSuggestion(true);
      try {
        const res = await suggestCategory({ text, imageUrl: imageDataUrl });
        if (!active) return;
        const data = res.data.data;
        setAiAvailable(data.aiAvailable);
        setSuggestion(data.aiAvailable ? data : null);
      } catch {
        if (!active) return;
        setAiAvailable(false);
        setSuggestion(null);
      } finally {
        if (active) setLoadingSuggestion(false);
      }
    }, 700);
    return () => {
      active = false;
      clearTimeout(debounceRef.current);
    };
  }, [itemText, imageDataUrl]);

  const acceptRecommendation = (rec) => {
    onChange({ categoryId: rec.categoryId, categoryName: rec.name, categorySource: "ai", categoryConfidence: rec.score });
  };

  const pickManual = (categoryId) => {
    const cat = categories.find((c) => c._id === categoryId);
    if (!cat) return;
    onChange({ categoryId: cat._id, categoryName: cat.name, categorySource: "user", categoryConfidence: null });
  };

  const confirmNewCategory = async () => {
    if (!suggestion?.newCategorySuggestion?.name || creatingCategory) return;
    setCreatingCategory(true);
    try {
      const response = await createCategory({
        name: suggestion.newCategorySuggestion.name,
        aliases: suggestion.newCategorySuggestion.tags,
      });
      const category = response.data.data.category;
      setCategories((current) => current.some((item) => item._id === category._id) ? current : [category, ...current]);
      onChange({ categoryId: category._id, categoryName: category.name, categorySource: "ai", categoryConfidence: null });
      setSuggestion(null);
    } catch {
      setAiAvailable(false);
    } finally {
      setCreatingCategory(false);
    }
  };

  const recommendation = suggestion?.recommendation;
  const newCategorySuggestion = suggestion?.newCategorySuggestion;
  const showRecommendationBanner =
    recommendation && !dismissedSuggestion && (!value || value.categorySource !== "user") && value?.categoryId !== recommendation.categoryId;

  return (
    <div className="field category-selector">
      <label>{label}</label>

      {value?.categoryId && (
        <div className="category-chip">
          <span className="badge badge-accent">{value.categoryName}</span>
          {value.categorySource === "ai" && (
            <span className="hint">AI suggested &middot; {Math.round((value.categoryConfidence || 0) * 100)}% match</span>
          )}
          <span className="hint">Use the category list below to change it.</span>
        </div>
      )}

      {loadingSuggestion && <p className="hint">Thinking about the best category...</p>}

      {showRecommendationBanner && (
        <div className="suggestion-banner">
          <div>
            <strong>AI suggests: {recommendation.name}</strong>
            {recommendation.confidence === "medium" && <p className="hint">Please verify the category before using it.</p>}
            {recommendation.confidence === "high" && <p className="hint">High-confidence match.</p>}
          </div>
          <div className="row gap-sm">
            <button type="button" className="btn btn-sm" onClick={() => acceptRecommendation(recommendation)}>
              Use this category
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDismissedSuggestion(true)}>
              Choose manually
            </button>
          </div>
        </div>
      )}

      {newCategorySuggestion && !dismissedSuggestion && !value?.categoryId && (
        <div className="suggestion-banner">
          <div>
            <strong>No existing category fits. AI proposes: {newCategorySuggestion.name}</strong>
            {newCategorySuggestion.tags?.length > 0 && (
              <p className="hint">Related terms: {newCategorySuggestion.tags.join(", ")}</p>
            )}
            <p className="hint">This category will be added only if you confirm.</p>
          </div>
          <div className="row gap-sm">
            <button type="button" className="btn btn-sm" disabled={creatingCategory} onClick={confirmNewCategory}>
              {creatingCategory ? "Adding..." : "Add this category"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDismissedSuggestion(true)}>
              Choose existing category
            </button>
          </div>
        </div>
      )}

      {!aiAvailable && !value?.categoryId && (
        <p className="hint">AI suggestions are temporarily unavailable. Please choose a category manually below.</p>
      )}

      {aiAvailable && suggestion?.noConfidentMatch && !recommendation && !newCategorySuggestion && !value?.categoryId && (
        <p className="hint">No confident category match. Please choose from the existing categories.</p>
      )}

      <div className="manual-category-picker">
        <label className="sr-only" htmlFor="canonical-category">Select a category</label>
        <select
          id="canonical-category"
          className="input"
          value={value?.categoryId || ""}
          onChange={(e) => pickManual(e.target.value)}
        >
          <option value="" disabled>
            {categories.length ? "Select a category" : "Loading categories..."}
          </option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default CategorySelector;
