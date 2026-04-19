import { useState } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import "./LoginPage.css";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API = "http://127.0.0.1:8000";

export default function LoginPage({ onLogin, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSuccess(credentialResponse) {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/auth/google`, {
        token: credentialResponse.credential,
      });
      onLogin(res.data);
    } catch (e) {
      console.error("Login error", e);
      setError(e.response?.data?.detail || "Login failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="en">
      <div className="ll-page">

        {/* LEFT — animated panel */}
        <div className="ll-left">
          <div className="ll-left-grid"></div>
          <div className="ll-orb ll-orb1"></div>
          <div className="ll-orb ll-orb2"></div>
          <div className="ll-orb ll-orb3"></div>

          <button className="ll-logo-btn" onClick={onBack}>Taka Gelo Koi<span>.</span></button>

          <div className="ll-left-content">
            <h2>Your finances,<br/><em>finally clear.</em></h2>
            <p>Log expenses in seconds. Understand your habits in minutes. Take control from day one.</p>
            <div className="ll-metrics">
              {[["1k+","Active users"],["৳2M+","Tracked monthly"],["Free","No credit card"]].map(([v,l]) => (
                <div key={l} className="ll-metric">
                  <div className="ll-metric-val">{v}</div>
                  <div className="ll-metric-lbl">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating cards */}
          <div className="ll-3d-scene">
            <div className="ll-float-card ll-fc1">
              <div className="ll-fc-ico">📊</div>
              <div><div className="ll-fc-title">Monthly Report</div><div className="ll-fc-sub">April 2026</div></div>
              <div className="ll-fc-val">৳28,430</div>
            </div>
            <div className="ll-float-card ll-fc2">
              <div className="ll-fc-ico">✅</div>
              <div><div className="ll-fc-title">Budget Status</div><div className="ll-fc-sub">All categories</div></div>
              <div className="ll-fc-val" style={{color:"var(--green)"}}>On track</div>
            </div>
            <div className="ll-float-card ll-fc3">
              <div className="ll-fc-ico">💰</div>
              <div><div className="ll-fc-title">Savings Goal</div><div className="ll-fc-sub">New Laptop</div></div>
              <div className="ll-fc-val" style={{color:"var(--gold)"}}>68%</div>
            </div>
          </div>

          <div className="ll-quote">
            <p>"Taka Gelo Koi completely changed how I think about money. Impossible to ignore where your spending goes."</p>
            <div className="ll-quote-author">— Rafi Ahmed, Freelance Designer</div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="ll-right">
          <div className="ll-form">
            <button className="ll-back" onClick={onBack}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
              Back to home
            </button>

            <div className="ll-form-title">Welcome to Taka Gelo Koi</div>
            <div className="ll-form-sub">Sign in with Google to access your personal dashboard. Your data stays private.</div>

            {loading ? (
              <div className="ll-loading">
                <div className="ll-spinner"></div>
                <span>Taking you to your dashboard…</span>
              </div>
            ) : (
              <div className="ll-google-wrap">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-in failed. Please try again.")}
                  useOneTap={false}
                  auto_select={false}
                  theme="filled_black"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  logo_alignment="left"
                  locale="en"
                  width="380"
                />
              </div>
            )}

            {error && (
              <div style={{color:"var(--red)",fontSize:".78rem",textAlign:"center",marginBottom:16,background:"var(--red-dim)",padding:"10px",borderRadius:8,border:"1px solid rgba(255,107,107,.2)"}}>
                {error}
              </div>
            )}

            <div className="ll-security">
              <div className="ll-sec-item">🔒 <span>Encrypted</span></div>
              <div className="ll-sec-item">🛡️ <span>OAuth 2.0</span></div>
              <div className="ll-sec-item">✓ <span>GDPR compliant</span></div>
            </div>
            <div className="ll-terms">
              By continuing, you agree to Taka Gelo Koi&apos;s <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
            </div>
          </div>
        </div>

      </div>
    </GoogleOAuthProvider>
  );
}

