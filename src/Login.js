import { useState } from "react";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
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
      // Check if email contains @, if not add @trivo.com
      const loginEmail = email.includes("@") ? email : `${email}@trivo.com`;
      
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === "pending" || data.status === "pending_admin") {
          setError("Account pending approval. Contact admin.");
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
    if (!password || !name || !phone) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);
    setError("");

    const auth = getAuth();
    const db = getFirestore();

    try {
      // Auto-generate email from name
      const autoEmail = `${name.toLowerCase().replace(/\s+/g, '')}@trivo.com`;
      
      const userCredential = await createUserWithEmailAndPassword(auth, autoEmail, password);
      const user = userCredential.user;

      const status = (selectedRole === "admin" || selectedRole === "driver") ? "pending" : "active";

      await setDoc(doc(db, "users", user.uid), {
        name,
        phone,
        role: selectedRole,
        email: autoEmail,
        createdAt: new Date().toISOString(),
        status,
      });

      // Notify all admins if pending approval
      if (status === "pending") {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const adminsQuery = query(collection(db, "users"), where("role", "==", "admin"));
        const adminsSnap = await getDocs(adminsQuery);
        
        for (const adminDoc of adminsSnap.docs) {
          await setDoc(doc(db, "notifications", `${adminDoc.id}_${Date.now()}`), {
            userId: adminDoc.id,
            type: "approval_request",
            message: `${name} requested ${selectedRole} account approval`,
            targetUserId: user.uid,
            createdAt: new Date().toISOString(),
            read: false,
          });
        }
      }

      alert(
        status === "pending"
          ? "Registration submitted! Wait for admin approval."
          : "Registration successful! Login: " + name
      );
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
            <label>{isSignup ? "Username" : "Username or Email"}</label>
            <input
              type="text"
              placeholder={isSignup ? "Your username" : "username or email"}
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