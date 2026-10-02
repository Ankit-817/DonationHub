import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { getImpact } from "../../api/impact";
import { getDonations, getMyDonations } from "../../api/donations";
import { getRequests, getMyRequests } from "../../api/requests";
import { getPendingApprovals, getMyTransactions } from "../../api/transactions";
import "./Home.css";

// Only genuinely unique actions live here - viewing "My donations" /
// "My requests" / notifications / chat is already one click away in the
// header nav, so repeating them here would just be redundant clutter.
const QUICK_LINKS = [
  { to: "/donations/new", label: "Donate an item", desc: "List something you no longer need" },
  { to: "/requests/new", label: "Request an item", desc: "Ask the community for something you need" },
];

function Home() {
  const { user } = useContext(AuthContext);
  const [impact, setImpact] = useState(null);
  const [recentDonations, setRecentDonations] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [userStats, setUserStats] = useState({
    myDonations: 0,
    myRequests: 0,
    activeDonations: 0,
    completedTransactions: 0,
  });

  const refreshHomeData = () => {
    getImpact().then((res) => setImpact(res.data.data)).catch(() => {});
    getDonations({ limit: 3 }).then((res) => setRecentDonations(res.data.data.donations || [])).catch(() => {});
    getRequests().then((res) => setRecentRequests((res.data.data.requests || []).slice(0, 3))).catch(() => {});

    getPendingApprovals()
      .then((res) => {
        const data = res.data.data || { incomingRequests: [], incomingOffers: [] };
        setPendingApprovals(data.incomingRequests.length + data.incomingOffers.length);
      })
      .catch(() => {});

    Promise.all([getMyDonations(), getMyRequests(), getMyTransactions()])
      .then(([donationsRes, requestsRes, transactionsRes]) => {
        const donations = donationsRes.data.data.donations || [];
        const requests = requestsRes.data.data.requests || [];
        const transactions = transactionsRes.data.data.transactions || [];
        setUserStats({
          myDonations: donations.length,
          myRequests: requests.length,
          activeDonations: donations.filter((d) => d.status === "pending" || d.status === "matched").length,
          completedTransactions: transactions.filter((t) => t.status === "completed").length,
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshHomeData();

    const handleDonationStatusUpdated = () => refreshHomeData();
    window.addEventListener("donation-status-updated", handleDonationStatusUpdated);

    return () => {
      window.removeEventListener("donation-status-updated", handleDonationStatusUpdated);
    };
  }, []);

  return (
    <div className="page">
      <section className="home-hero">
        <div>
          <span className="badge badge-accent">Welcome back</span>
          <h1>Hi {user?.name?.split(" ")[0] || "there"}, what would you like to do today?</h1>
          <p className="text-muted">Donate an item, request one, or check in on your active matches.</p>
        </div>
      </section>

      {pendingApprovals > 0 && (
        <Link to="/approvals" className="card card-pad home-alert">
          <strong>{pendingApprovals} item{pendingApprovals > 1 ? "s" : ""} waiting on you.</strong>
          <span>Requests for your donations or offers on your requests - review now →</span>
        </Link>
      )}

      <div className="grid grid-2 home-quick-links">
        {QUICK_LINKS.map((q) => (
          <Link to={q.to} key={q.to} className="card card-pad quick-link quick-link-primary">
            <h3>{q.label}</h3>
            <p>{q.desc}</p>
          </Link>
        ))}
      </div>

      <section className="card card-pad impact-strip">
        <div><strong>{userStats.myDonations}</strong><span>My Donations</span></div>
        <div><strong>{userStats.myRequests}</strong><span>My Requests</span></div>
        <div><strong>{userStats.activeDonations}</strong><span>Active Donations</span></div>
        <div><strong>{userStats.completedTransactions}</strong><span>Completed Transactions</span></div>
        {impact && <div><strong>{impact.successfulDonations}</strong><span>Community Successful Donations</span></div>}
      </section>

      <div className="grid grid-2 home-sections">
        <section>
          <div className="row-between">
            <h2 className="section-title">Recently donated items</h2>
            <Link to="/donations" className="text-muted">See all →</Link>
          </div>
          <div className="stack gap-sm">
            {recentDonations.length === 0 && <p className="text-muted">No donations to show yet.</p>}
            {recentDonations.map((d) => (
              <Link to="/donations" key={d._id} className="card card-pad home-item-row">
                <img src={d.item?.imageUrl?.[0] || "/donationItems.jpg"} alt={d.item?.name} />
                <div>
                  <strong>{d.item?.name}</strong>
                  <span className="text-muted">{d.item?.condition}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="row-between">
            <h2 className="section-title">Active requests</h2>
            <Link to="/requests" className="text-muted">See all →</Link>
          </div>
          <div className="stack gap-sm">
            {recentRequests.length === 0 && <p className="text-muted">No open requests right now.</p>}
            {recentRequests.map((r) => (
              <Link to="/requests" key={r._id} className="card card-pad home-item-row">
                <div className="stack" style={{ flex: 1 }}>
                  <strong>{r.itemType}</strong>
                  <span className="text-muted">Needs {r.quantity} · {r.urgency} urgency</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;
