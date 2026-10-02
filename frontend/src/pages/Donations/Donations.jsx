import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDonations } from "../../api/donations";
import { getCategories } from "../../api/categories";
import "./Donations.css";

const CONDITIONS = ["new", "like_new", "used"];

function Donations() {
  const [donations, setDonations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState("");
  const [sort, setSort] = useState("recent");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.data.data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  // A single effect drives every fetch (filters, sort, page, and a
  // debounced search) so changing several filters in a row never fires
  // more than one request per settled change - see spec #75. Filter
  // changes reset the page via the same event handler that sets the
  // filter (see onChange handlers below), so this effect only ever runs
  // once per actual settled change, never twice.
  useEffect(() => {
    const debounceMs = search ? 350 : 0;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const { data } = await getDonations({ categoryId, condition, sort, search, page, limit: 9 });
        setDonations(data.data.donations || []);
        setTotalPages(data.data.totalPages || 1);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, condition, sort, search, page]);

  // Each of these batches the filter change with a page reset into the
  // same render, so only one effect run (and one request) results.
  const onCategoryChange = (e) => { setCategoryId(e.target.value); setPage(1); };
  const onConditionChange = (e) => { setCondition(e.target.value); setPage(1); };
  const onSortChange = (e) => { setSort(e.target.value); setPage(1); };
  const onSearchChange = (e) => { setSearch(e.target.value); setPage(1); };

  return (
    <div className="page">
      <div className="page-header row-between wrap gap-md">
        <div>
          <h1>Browse donations</h1>
          <p>Items generously donated by our community, ready to be requested.</p>
        </div>
        <Link to="/donations/new" className="btn btn-accent">+ Donate an item</Link>
      </div>

      <div className="donations-filters card card-pad">
        <input className="input" placeholder="Search items..." value={search} onChange={onSearchChange} />
        <select className="input" value={categoryId} onChange={onCategoryChange}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select className="input" value={condition} onChange={onConditionChange}>
          <option value="">Any condition</option>
          {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
        </select>
        <select className="input" value={sort} onChange={onSortChange}>
          <option value="recent">Most recent</option>
          <option value="oldest">Oldest first</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="name_desc">Name (Z-A)</option>
        </select>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="empty-state">
          <h3>Unable to load donations</h3>
          <p>Something went wrong on our end - try again shortly.</p>
        </div>
      ) : donations.length === 0 ? (
        <div className="empty-state">
          <h3>No donations match your filters</h3>
          <p>Try clearing a filter, or check back soon - new items are added often.</p>
        </div>
      ) : (
        <div className="grid grid-3 donations-grid">
          {donations.map((donation) => (
            <Link to={`/donations/${donation._id}/request`} key={donation._id} className="card donation-card">
              <img className="donation-image" src={donation.item?.imageUrl?.[0] || "/donationItems.jpg"} alt={donation.item?.name} />
              <div className="card-pad stack gap-xs">
                <span className="badge badge-neutral">{donation.item?.category?.replace("_", " ")}</span>
                <h3>{donation.item?.name}</h3>
                <p className="text-muted">{donation.item?.description || "No description provided."}</p>
                <div className="row-between">
                  <span className="badge badge-info">{donation.item?.condition}</span>
                  <span className="btn btn-sm">Request</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="row gap-xs" style={{ justifyContent: "center", marginTop: "2rem" }}>
          {[...Array(totalPages)].map((_, i) => (
            <button key={i} className={`btn btn-sm ${i + 1 === page ? "" : "btn-outline"}`} onClick={() => setPage(i + 1)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Donations;
