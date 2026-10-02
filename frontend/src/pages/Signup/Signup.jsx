import React, { useContext, useState } from "react";
import { FaLocationArrow } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import LocationMap from "../../components/LocationMap/LocationMap";
import { AuthContext } from "../../contexts/AuthContext";
import "./Signup.css";

function Signup() {
  const [latLng, setLatLng] = useState({ lat: "", lng: "" });
  const [address, setAddress] = useState("");
  const [goToMyLocation, setGoToMyLocation] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { register } = useContext(AuthContext);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!latLng.lat || !latLng.lng) {
      toast.error("Please select your location on the map so nearby matches and pickups work correctly.");
      return;
    }
    if (!address) {
      toast.error("We couldn't resolve an address for that point - try clicking again.");
      return;
    }

    setSubmitting(true);
    try {
      await register({ ...formData, address, coordinates: latLng });
      toast.success("Welcome to Donation Hub!");
      navigate("/home");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong!");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="sidebar">
          <div className="logo-container">
            <div className="logo-circle">
              <svg viewBox="0 0 24 24" width={40} height={40} fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 10c-2.21 0-4-1.79-4-4h2c0 1.1.9 2 2 2s2-.9 2-2h2c0 2.21-1.79 4-4 4z" />
              </svg>
            </div>
          </div>
          <div className="welcome-text">
            <h2>Welcome to Donation Hub</h2>
            <p>Give what you can. Help someone nearby.</p>
          </div>
        </div>

        <div className="main-content">
          <div className="form-map-wrapper">
            <form id="signupForm" className="form-column" onSubmit={handleSubmit}>
              <div className="signup-header">
                <h2>Create your account</h2>
              </div>

              <div className="form-group">
                <input type="text" id="name" placeholder="Full name" required value={formData.name} onChange={handleChange} />
              </div>
              <div className="form-group">
                <input type="email" id="email" placeholder="Email" required value={formData.email} onChange={handleChange} />
              </div>
              <div className="form-group">
                <input type="text" id="phone" placeholder="Phone number" required value={formData.phone} onChange={handleChange} />
              </div>
              <div className="form-group password-field" style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  style={{ paddingRight: "40px" }}
                />
                <span
                  className="eye-icon"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}
                >
                  {showPassword ? "Hide" : "Show"}
                </span>
              </div>

              <button type="submit" className="signup-btn" disabled={submitting}>
                {submitting ? "Creating account..." : "Sign up"}
              </button>
            </form>

            <div className="map-column">
              <label style={{ marginBottom: "10px", display: "block" }}>
                Location (click on the map)
              </label>
              <LocationMap setLatLng={setLatLng} setAddress={setAddress} setGoToMyLocation={setGoToMyLocation} />
              <div id="coordinates" style={{ marginTop: "10px", color: "#555", fontSize: "14px" }}>
                <p>{address ? `Selected address: ${address}` : "Click on the map to select a location."}</p>
              </div>
              <button type="button" className="location-btn" onClick={() => goToMyLocation && goToMyLocation()}>
                <FaLocationArrow style={{ marginRight: "8px" }} />
                Use my current location
              </button>
            </div>
          </div>
          <div className="login-prompt">
            <span>Already a member?</span>
            <Link to="/login" className="login-prompt-p">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
