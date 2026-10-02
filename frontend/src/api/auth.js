import api from "./client";

export const registerRequest = (payload) => api.post("/api/users/register", payload);
export const loginRequest = (email, password) => api.post("/api/users/login", { email, password });
export const logoutRequest = () => api.post("/api/users/logout");
export const refreshRequest = () => api.post("/api/users/refresh");
export const getUserById = (id) => api.get(`/api/users/${id}`);
export const updateUserById = (id, payload) => api.patch(`/api/users/${id}`, payload);
export const deleteUserById = (id) => api.delete(`/api/users/${id}`);
