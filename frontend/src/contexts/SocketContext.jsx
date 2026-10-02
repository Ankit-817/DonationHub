import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";
import { getAccessToken } from "../api/client";

const SocketContext = createContext();

// This context's ONLY job is the chat socket connection - notifications,
// the homepage counter, matching, etc. all go through REST elsewhere.
export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnected(false);
      return;
    }

    // The server authenticates this connection from the token itself -
    // no client-supplied user id is ever trusted (see backend/src/socket.js).
    const newSocket = io(import.meta.env.VITE_API_BASE_URL, {
      auth: { token: getAccessToken() },
      withCredentials: true,
    });

    newSocket.on("connect", () => setConnected(true));
    newSocket.on("disconnect", () => setConnected(false));
    newSocket.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Join a transaction's chat room; resolves once the server confirms
  // the user is a participant and the transaction is chat-eligible.
  const joinTransaction = useCallback(
    (transactionId) =>
      new Promise((resolve, reject) => {
        if (!socket) return reject(new Error("Socket not connected"));
        socket.emit("joinTransaction", transactionId, (ack) => {
          if (ack?.success) resolve(ack);
          else reject(new Error(ack?.message || "Unable to join chat"));
        });
      }),
    [socket]
  );

  const leaveTransaction = useCallback(
    (transactionId) => {
      socket?.emit("leaveTransaction", transactionId);
    },
    [socket]
  );

  return (
    <SocketContext.Provider value={{ socket, connected, joinTransaction, leaveTransaction }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
