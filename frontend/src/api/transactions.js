import api from "./client";

export const getMyTransactions = () => api.get("/api/transactions/mine");
export const getPendingApprovals = () => api.get("/api/transactions/approvals");
export const getTransaction = (transactionId) => api.get(`/api/transactions/${transactionId}`);
export const createTransaction = (payload) => api.post("/api/transactions", payload);
export const offerHelp = (payload) => api.post("/api/transactions/offer", payload);
export const respondToTransaction = (transactionId, response) =>
  api.post(`/api/transactions/${transactionId}/respond`, { response });
export const proposePickup = (transactionId, scheduledDate, note) =>
  api.post(`/api/transactions/${transactionId}/pickup`, { scheduledDate, note });
export const respondToPickup = (transactionId, response, scheduledDate, note) =>
  api.post(`/api/transactions/${transactionId}/pickup/respond`, { response, scheduledDate, note });
export const completeTransaction = (transactionId) => api.post(`/api/transactions/${transactionId}/complete`);
export const cancelTransaction = (transactionId) => api.post(`/api/transactions/${transactionId}/cancel`);
