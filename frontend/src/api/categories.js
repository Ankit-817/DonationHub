import api from "./client";

export const getCategories = () => api.get("/api/categories");

// text and/or imageUrl (a data: URI or https URL) - the backend never
// receives a hardcoded category list, only free-form input (spec #18-21).
export const suggestCategory = ({ text, imageUrl }) =>
  api.post("/api/categories/suggest", { text, imageUrl });

export const createCategory = ({ name, description, aliases, parentCategoryId }) =>
  api.post("/api/categories", { name, description, aliases, parentCategoryId });
