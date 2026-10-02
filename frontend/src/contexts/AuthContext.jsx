import React, { createContext, useState, useEffect, useCallback } from "react";
import { setAccessToken } from "../api/client";
import { loginRequest, registerRequest, logoutRequest, refreshRequest } from "../api/auth";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const authenticated = !!user;
  const isAdmin = !!user?.isAdmin;

  // On app start (including a browser refresh) we never have an access
  // token in memory yet, so we try the refresh endpoint straight away -
  // the browser sends the HttpOnly cookie automatically. If it succeeds
  // the user stays logged in without ever seeing a login screen again.
  useEffect(() => {
    (async () => {
      try {
        const res = await refreshRequest();
        setAccessToken(res.data.data.accessToken);
        setUser(res.data.data.user);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await loginRequest(email, password);
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await registerRequest(payload);
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Even if the request fails, clear local state so the UI reflects
      // "logged out" immediately.
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, authenticated, isAdmin, loading, login, register, logout, setUser, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};
