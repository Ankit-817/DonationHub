import api from "./client";

export const getMessages = (transactionId) => api.get(`/api/messages/${transactionId}`);
export const sendMessage = (transactionId, content) => api.post(`/api/messages/${transactionId}`, { content });
export const markMessagesRead = (transactionId) => api.patch(`/api/messages/${transactionId}/read`);
