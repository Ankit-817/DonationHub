import api from "./client";

export const getDonations = (params) => api.get("/api/donations", { params });
export const getDonation = (id) => api.get(`/api/donations/${id}`);
export const getMyDonations = () => api.get("/api/donations/mine");
export const createDonation = (formData) =>
  api.post("/api/donations", formData, { headers: { "Content-Type": "multipart/form-data" } });
