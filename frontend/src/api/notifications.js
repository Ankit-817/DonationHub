import api from "./client";

export const getNotifications = () => api.get("/api/notifications");
export const markNotificationRead = (id) => api.patch(`/api/notifications/${id}/read`);
export const deleteNotification = (id) => api.delete(`/api/notifications/${id}`);
