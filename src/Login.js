import { useState } from "react";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import DriverDashboard from "./DriverDashboard";
import RiderDashboard from "./RiderDashboard";
import AdminDashboard from "./AdminDashboard";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(null);
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
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

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === "pending") {
          setError("Account pending approval. Contact admin at Admin1973@trivo.com");
          await auth.signOut();
          return;
        }
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

    // Validate email format
    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");

    const auth = getAuth();
    const db = getFirestore();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // All users need admin approval
      await setDoc(doc(db, "users", user.uid), {
        name,
        phone,
        role: selectedRole,
        email: email,
        createdAt: new Date().toISOString(),
        status: "pending",
      });

      // Notify admin (Admin1973@trivo.com)
      const adminQuery = query(collection(db, "users"), where("email", "==", "Admin1973@trivo.com"));
      const adminSnap = await getDocs(adminQuery);
      
      if (!adminSnap.empty) {
        const adminDoc = adminSnap.docs[0];
        await setDoc(doc(db, "notifications", `${adminDoc.id}_${Date.now()}`), {
          userId: adminDoc.id,
          type: "approval_request",
          message: `${name} (${email}) requested ${selectedRole} account approval`,
          targetUserId: user.uid,
          targetUserEmail: email,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }

      alert("Registration submitted! Wait for admin approval at Admin1973@trivo.com");
      setIsSignup(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (role === "admin") return <AdminDashboard />;
  if (role === "driver") return <DriverDashboard />;
  if (role === "rider") return <RiderDashboard />;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🚗 Trivo</h1>
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
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="your.email@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  <option value="admin">👨‍💼 Admin</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="your.email@gmail.com"
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