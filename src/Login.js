import { useState } from "react";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import DriverDashboard from "./DriverDashboard";
import RiderDashboard from "./RiderDashboard";
import Profile from "./Profile";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(null);
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  
  // Signup fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState("rider");

  const login = async () => {
    if (!email || !password) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);
    setError("");

    const auth = getAuth();
    const db = getFirestore();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get user role from Firestore
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setRole(data.role);
      } else {
        setError("No profile found! Please contact support.");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const signup = async () => {
    if (!email || !password || !name || !phone) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);
    setError("");

    const auth = getAuth();
    const db = getFirestore();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user profile in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name,
        phone,
        role: selectedRole,
        email,
        createdAt: new Date().toISOString(),
      });

      setRole(selectedRole);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showProfile) {
    return <Profile onBack={() => setShowProfile(false)} />;
  }

  if (role === "driver") return <DriverDashboard />;
  if (role === "rider") return <RiderDashboard />;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🚗 Trip Tracker</h1>
          <p>Your ride, your way</p>
        </div>

        <div className="tabs">
          <button
            className={!isSignup ? "tab active" : "tab"}
            onClick={() => {
              setIsSignup(false);
              setError("");
            }}
          >
            Login
          </button>
          <button
            className={isSignup ? "tab active" : "tab"}
            onClick={() => {
              setIsSignup(true);
              setError("");
            }}
          >
            Sign Up
          </button>
        </div>

        <div className="form">
          {isSignup && (
            <>
              <div className="input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="input-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="+20 XXX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="input-group">
                <label>I am a</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="input-field"
                >
                  <option value="rider">🧍 Rider</option>
                  <option value="driver">🚗 Driver</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            className="submit-btn"
            onClick={isSignup ? signup : login}
            disabled={loading}
          >
            {loading ? "Please wait..." : isSignup ? "Create Account" : "Login"}
          </button>
        </div>

        <div className="footer">
          <p>
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <span
              className="link"
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
              }}
            >
              {isSignup ? "Login" : "Sign up"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}