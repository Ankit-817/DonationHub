import { useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";import "./App.css";
import { AuthContext } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Layout from "./components/Layout/Layout";
import FrontPage from "./pages/FrontPage/FrontPage";
import Login from "./pages/Login/Login";
import Signup from "./pages/Signup/Signup";
import Home from "./pages/Home/Home";
import Donations from "./pages/Donations/Donations";
import MyDonations from "./pages/Donations/MyDonations";
import DonationForm from "./pages/Donations/DonationForm";
import Requests from "./pages/Requests/Requests";
import MyRequests from "./pages/Requests/MyRequests";
import RequestForm from "./pages/Requests/RequestForm";
import OfferHelp from "./pages/OfferHelp/OfferHelp";
import RequestDonation from "./pages/RequestDonation/RequestDonation";
import Approvals from "./pages/Approvals/Approvals";
import TransactionChat from "./pages/TransactionChat/TransactionChat";
import Inbox from "./pages/Inbox/Inbox";
import PickupChoice from "./pages/PickupChoice/PickupChoice";
import Notifications from "./pages/Notifications/Notifications";
import Profile from "./pages/Profile/Profile";
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard";

function App() {
  const { authenticated, isAdmin, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <ToastContainer position="top-right" autoClose={4000} />
      <BrowserRouter>
        <Routes>
          {/* Public marketing / auth routes */}
          <Route path="/" element={authenticated ? <Navigate to="/home" /> : <FrontPage />} />
          <Route path="/login" element={authenticated ? <Navigate to="/home" /> : <Login />} />
          <Route path="/signup" element={authenticated ? <Navigate to="/home" /> : <Signup />} />

          {/* Authenticated area - single shared header/footer shell.
              Every feature lives under here and is always reachable from
              the header, no matter which page the user is on. */}
          <Route element={authenticated ? <Layout /> : <Navigate to="/login" />}>
            <Route path="/home" element={<Home />} />

            <Route path="/donations" element={<Donations />} />
            <Route path="/donations/new" element={<DonationForm />} />
            <Route path="/donations/:donationId/request" element={<RequestDonation />} />
            <Route path="/my-donations" element={<MyDonations />} />

            <Route path="/requests" element={<Requests />} />
            <Route path="/requests/new" element={<RequestForm />} />
            <Route path="/requests/:requestId/offer" element={<OfferHelp />} />
            <Route path="/my-requests" element={<MyRequests />} />

            <Route path="/approvals" element={<Approvals />} />

            <Route path="/chat" element={<Inbox />} />
            <Route path="/transactions/:transactionId/chat" element={<TransactionChat />} />
            <Route path="/transactions/:transactionId/pickup" element={<PickupChoice />} />

            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />

            <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/home" />} />

            <Route path="*" element={<Navigate to="/home" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;
