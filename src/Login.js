import { useState } from "react";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import DriverDashboard from "./DriverDashboard";
import RiderDashboard from "./RiderDashboard";
import AdminDashboard from "./AdminDashboard";
import { useLanguage } from "./LanguageContext";
import "./Login.css";

export default function Login() {
  // eslint-disable-next-line
  const { t, toggleLanguage, language } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(null);
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
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
        setError("No profile found!");
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

      await setDoc(doc(db, "users", user.uid), {
        name,
        phone,
        role: selectedRole,
        email: email,
        createdAt: new Date().toISOString(),
        status: "pending",
      });

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

      alert("Registration submitted! Wait for admin approval");
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
            onClick={() => { setIsSignup(false); setError(""); }}
          >
            {t('login')}
          </button>
          <button
            className={isSignup ? "tab active" : "tab"}
            onClick={() => { setIsSignup(true); setError(""); }}
          >
            {t('signup')}
          </button>
        </div>

        <div className="form">
          {isSignup && (
            <>
              <div className="input-group">
                <label>{t('fullName')}</label>
                <input
                  type="text"
                  placeholder={t('fullName')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="input-group">
                <label>{t('email')}</label>
                <input
                  type="email"
                  placeholder="your.email@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="input-group">
                <label>{t('phone')}</label>
                <input
                  type="tel"
                  placeholder="+20 XXX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="input-group">
                <label>{t('iAm')}</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="input-field"
                >
                  <option value="rider">🧍 {t('rider')}</option>
                  <option value="driver">🚗 {t('driver')}</option>
                  <option value="admin">👨‍💼 {t('admin')}</option>
                </select>
              </div>
            </>
          )}

          <div className="input-group">
            <label>{t('email')}</label>
            <input
              type="email"
              placeholder="your.email@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="input-group">
            <label>{t('password')}</label>
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
            {loading ? "..." : isSignup ? t('createAccount') : t('login')}
          </button>
        </div>

        <div className="footer">
          <p>
            {isSignup ? t('alreadyHaveAccount') : t('dontHaveAccount')}{" "}
            <span
              className="link"
              onClick={() => { setIsSignup(!isSignup); setError(""); }}
            >
              {isSignup ? t('login') : t('signup')}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}