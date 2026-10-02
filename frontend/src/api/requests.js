import api from "./client";

export const getRequests = () => api.get("/api/requests");
export const getMyRequests = () => api.get("/api/requests/mine");
export const createRequest = (payload) => api.post("/api/requests", payload);
export const getMatchingDonations = (requestId, params) =>
  api.get(`/api/requests/${requestId}/matches`, { params });
