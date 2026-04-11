import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import "./Profile.css";

export default function Profile({ onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("rider");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        setEmail(user.email);
        
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || "");
          setPhone(data.phone || "");
          setRole(data.role || "rider");
        }
      }
    };
    loadProfile();
  }, []);

  const saveProfile = async () => {
    const user = auth.currentUser;
    
    if (!name || !phone) {
      setMessage("Please fill all fields");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Update Firestore
      const status = (role === 'driver' || role === 'admin') ? 'pending' : 'active';
      
      await updateDoc(doc(db, "users", user.uid), {
        name,
        phone,
        role,
        status,
        updatedAt: new Date().toISOString(),
      });

      // Update Firebase Auth display name
      await updateProfile(user, {
        displayName: name,
      });

      if (status === 'pending') {
        setMessage("✅ Profile updated! Waiting for admin approval.");
      } else {
        setMessage("✅ Profile updated successfully!");
      }
      setIsEditing(false);
      
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>My Profile</h1>
        <button 
          className="edit-btn"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? "Cancel" : "Edit"}
        </button>
      </div>

      <div className="profile-card">
        <div className="avatar">
          {name ? name.charAt(0).toUpperCase() : "👤"}
        </div>

        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditing}
            className="profile-input"
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="profile-input disabled"
          />
          <p className="hint">Email cannot be changed</p>
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            placeholder="+20 XXX XXX XXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={!isEditing}
            className="profile-input"
          />
        </div>

        <div className="form-group">
          <label>Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={!isEditing}
            className="profile-input"
          >
            <option value="rider">🧍 Rider</option>
            <option value="driver">🚗 Driver</option>
          </select>
          <p className="hint">Choose how you want to use the app</p>
        </div>

        {isEditing && (
          <button
            className="save-btn"
            onClick={saveProfile}
            disabled={loading}
          >
            {loading ? "Saving..." : "💾 Save Changes"}
          </button>
        )}

        {message && (
          <div className={message.includes("❌") ? "message error" : "message success"}>
            {message}
          </div>
        )}
      </div>

      <div className="info-section">
        <h3>Account Information</h3>
        <div className="info-item">
          <span className="info-label">Account Status:</span>
          <span className="info-value active">Active</span>
        </div>
        <div className="info-item">
          <span className="info-label">Member Since:</span>
          <span className="info-value">
            {auth.currentUser?.metadata?.creationTime 
              ? new Date(auth.currentUser.metadata.creationTime).toLocaleDateString()
              : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}