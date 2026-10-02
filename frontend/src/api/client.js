import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // lets the HttpOnly refresh cookie travel with requests
});

// The short-lived access token lives ONLY in memory (never localStorage),
// per the auth redesign - it's attached to every request from here.
let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// If five requests fail at once because the access token expired, we only
// want ONE refresh call in flight - everyone else waits on the same promise
// and then retries with the new token.
let refreshPromise = null;

const performRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/api/users/refresh")
      .then((res) => {
        const token = res.data?.data?.accessToken;
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isRefreshCall = config?.url?.includes("/api/users/refresh");
    const isAuthCall = config?.url?.includes("/api/users/login") || config?.url?.includes("/api/users/register");

    if (response?.status === 401 && !config._retry && !isRefreshCall && !isAuthCall) {
      config._retry = true;
      try {
        const token = await performRefresh();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        }
      } catch {
        setAccessToken(null);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
