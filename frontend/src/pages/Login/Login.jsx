import "./Login.css";
import { Link, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { AuthContext } from "../../contexts/AuthContext";

function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      toast.error("Please fill in both fields!", { autoClose: 2000 });
      return;
    }

    setSubmitting(true);
    try {
      await login(formData.email, formData.password);
      toast.success("Login successful!", { autoClose: 1000 });
      navigate("/home");
    } catch (error) {
      toast.error(error.response?.data?.message || "Server error. Try again!", { autoClose: 2000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
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
          <div className="login-header">
            <h2>Log in to your account</h2>
          </div>
          <form
            id="loginForm"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div className="form-group flex">
              <input
                type="email"
                placeholder="Email address"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group password-field" style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Password"
                name="password"
                required
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
            <button type="submit" className="login-btn" disabled={submitting}>
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>
          <div className="login-prompt">
            <span>New to Donation Hub?</span>
            <Link to="/signup" className="login-prompt-p">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
