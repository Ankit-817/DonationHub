import api from "./client";

export const getImpact = () => api.get("/api/impact");
