import { Link } from "react-router-dom";
import "./FrontPage.css";
import Impact from "../../components/Impact/Impact";

function FrontPage() {
  return (
    <>
      <header>
        <a href="#home" className="logo">
          <svg viewBox="0 0 24 24" width={30} height={30} fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 10c-2.21 0-4-1.79-4-4h2c0 1.1.9 2 2 2s2-.9 2-2h2c0 2.21-1.79 4-4 4z" />
          </svg>
          Donation Hub
        </a>
        <nav>
          <a href="#home" className="active">Home</a>
          <a href="#how-it-works">How it works</a>
          <a href="#impact-container">Our impact</a>
        </nav>
        <div className="header-cta">
          <Link to="/login" className="btn btn-outline btn-sm">Log in</Link>
          <Link to="/signup" className="btn btn-sm">Sign up</Link>
        </div>
      </header>

      <main>
        <section id="home" className="hero">
          <div className="hero-content">
            <h1>Give what you can. Help someone nearby.</h1>
            <p>
              Donate useful items or request things you need from people in
              your community - matched by location, category, and condition.
            </p>
            <div className="btn-group">
              <Link to="/signup" className="btn">Donate an Item</Link>
              <Link to="/signup" className="btn btn-outline">Request an Item</Link>
            </div>
            <div className="btn-group secondary-links">
              <Link to="/login">Browse Donations →</Link>
              <Link to="/login">Browse Requests →</Link>
            </div>
          </div>
          <div className="hero-image">
            <img src="/donationItems.jpg" alt="Donated items ready to be given away" />
          </div>
        </section>

        <section id="how-it-works" className="how-it-works">
          <h2>How Donation Hub works</h2>
          <p>Four simple steps connect what you have with what someone nearby needs.</p>
          <div className="steps">
            <div className="step">
              <div className="step-icon">
                <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor">
                  <path d="M16 6V4.5C16 3.12 14.88 2 13.5 2h-3C9.11 2 8 3.12 8 4.5V6H4v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6h-4z" />
                </svg>
              </div>
              <h3>Donate or request</h3>
              <p>List an item you no longer need, or post what you're looking for.</p>
            </div>
            <div className="step">
              <div className="step-icon">
                <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor">
                  <path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z" />
                </svg>
              </div>
              <h3>Find a match</h3>
              <p>We match by category, condition, and distance so it's relevant and nearby.</p>
            </div>
            <div className="step">
              <div className="step-icon">
                <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <h3>Connect</h3>
              <p>Once a donor approves, chat opens up to coordinate the details.</p>
            </div>
            <div className="step">
              <div className="step-icon">
                <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor">
                  <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z" />
                </svg>
              </div>
              <h3>Complete the donation</h3>
              <p>Arrange a self pickup, hand it over, and mark it complete.</p>
            </div>
          </div>
        </section>

        <section id="impact-container">
          <Impact />
        </section>

        <section className="how-to-start">
          <h2>Ready to get started?</h2>
          <p>Create a free account to donate or request items in your area.</p>
          <Link to="/signup" className="btn">Join Donation Hub</Link>
        </section>
      </main>

      <footer>
        <div className="footer-logo">Donation Hub</div>
        <p className="footer-text">Connecting donors with those in need, one item at a time.</p>
      </footer>
    </>
  );
}

export default FrontPage;
