import { useContext, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthContext } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { completeTransaction, getTransaction } from "../../api/transactions";
import { getMessages, sendMessage, markMessagesRead } from "../../api/messages";
import "./TransactionChat.css";

function TransactionChat() {
  const { transactionId } = useParams();
  const { user } = useContext(AuthContext);
  const { socket, joinTransaction } = useSocket();
  const [transaction, setTransaction] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const bottomRef = useRef(null);

  const loadAll = async () => {
    try {
      const [{ data: txData }, { data: msgData }] = await Promise.all([
        getTransaction(transactionId),
        getMessages(transactionId),
      ]);
      setTransaction(txData.data.transaction);
      setMessages(msgData.data.messages);
      markMessagesRead(transactionId).catch(() => {});
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => { loadAll(); }, [transactionId]);

  // Join the transaction's chat room once the socket is ready - this is
  // ONLY for real-time delivery of the other participant's messages.
  // Persistence and the sender's own view of a sent message always come
  // from the REST calls above/below, so chat still works if this fails.
  useEffect(() => {
    if (!socket) return;
    joinTransaction(transactionId).catch(() => {
      // Non-fatal: REST GET/POST still work without the live socket.
    });
  }, [socket, transactionId, joinTransaction]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => {
      setMessages((prev) => {
        // Dedupe by _id - guards against overlap between this event and
        // the sender's own REST response (see handleSend below).
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };
    socket.on("newMessage", onMessage);
    return () => socket.off("newMessage", onMessage);
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data } = await sendMessage(transactionId, text.trim());
      // Append from the REST response directly - the sender never
      // depends on receiving their own Socket.IO echo (see spec #27).
      setMessages((prev) => {
        if (prev.some((m) => m._id === data.data.message._id)) return prev;
        return [...prev, data.data.message];
      });
      setText("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const markDonationReceived = async () => {
    setCompleting(true);
    try {
      const response = await completeTransaction(transactionId);
      setTransaction(response.data.data.transaction);
      window.dispatchEvent(new CustomEvent("donation-status-updated"));
      toast.success("Donation completed. Thanks for confirming!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not complete the donation.");
    } finally {
      setCompleting(false);
    }
  };

  if (loadError) {
    return (
      <div className="page empty-state">
        <h3>Unable to load this conversation</h3>
        <p>It may not exist, or you may not have access to it.</p>
      </div>
    );
  }
  if (!transaction) return <div className="page"><div className="spinner" /></div>;

  const idOf = (value) => (value && typeof value === "object" && value._id ? String(value._id) : String(value ?? ""));
  const isRecipient = idOf(transaction.recipientId) === idOf(user?._id);
  const other = idOf(transaction.donorId) === idOf(user?._id) ? transaction.recipientId : transaction.donorId;

  return (
    <div className="page-narrow chat-page">
      <div className="card chat-card">
        <div className="chat-header row-between">
          <div className="row gap-sm">
            <span className="avatar-circle">{other?.name?.charAt(0)?.toUpperCase() || "?"}</span>
            <div className="stack">
              <strong>{other?.name}</strong>
              <span className="text-muted" style={{ fontSize: "0.8rem" }}>Re: {transaction.itemId?.name}</span>
            </div>
          </div>
          {transaction.status === "approved" && (
            <Link to={`/transactions/${transactionId}/pickup`} className="btn btn-sm btn-accent">Arrange pickup →</Link>
          )}
          {transaction.status === "pickup_arranged" && (
            <div className="row gap-sm">
              {isRecipient && (
                <button className="btn btn-sm btn-accent" disabled={completing} onClick={markDonationReceived}>
                  {completing ? "Completing..." : "Confirm donation received"}
                </button>
              )}
              <Link to={`/transactions/${transactionId}/pickup`} className="btn btn-sm btn-outline">Pickup details</Link>
            </div>
          )}
          {transaction.status === "completed" && (
            <Link to={`/transactions/${transactionId}/pickup`} className="badge badge-success">Donation completed · view details</Link>
          )}
        </div>

        <div className="chat-body">
          {messages.length === 0 && <p className="text-muted text-center" style={{ marginTop: "2rem" }}>Say hello 👋</p>}
          {messages.map((m) => (
            <div key={m._id} className={`chat-bubble-row ${m.sender?._id === user?._id ? "mine" : ""}`}>
              <div className="chat-bubble">
                <p>{m.content}</p>
                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="chat-input-row" onSubmit={handleSend}>
          <input className="input" placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" disabled={sending || !text.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}

export default TransactionChat;
