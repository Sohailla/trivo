import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, getDoc, query, where, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useLanguage } from "./LanguageContext";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [lines, setLines] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("users");
  const [userFilter, setUserFilter] = useState("all");
  const [showProfile, setShowProfile] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  
  // Line form
  const [showLineForm, setShowLineForm] = useState(false);
  const [lineName, setLineName] = useState("");
  const [pickPoints, setPickPoints] = useState([""]);
  const [destinations, setDestinations] = useState([""]);
  const [assignedDriver, setAssignedDriver] = useState("");
  const [tripTime, setTripTime] = useState("08:00");
  const [maxSeats, setMaxSeats] = useState(10);
  const [allowMultipleCars, setAllowMultipleCars] = useState(false);

  useEffect(() => {
    const loadAdmin = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAdminInfo(docSnap.data());
        }
      }
    };
    loadAdmin();

    // Listen to users
    const usersUnsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setPendingUsers(usersList.filter(u => u.status === "pending"));
    });

    // Listen to lines
    const linesUnsub = onSnapshot(collection(db, "lines"), (snapshot) => {
      const linesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLines(linesList);
    });

    // Listen to bookings
    const bookingsUnsub = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const bookingsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBookings(bookingsList);
    });

    return () => {
      usersUnsub();
      linesUnsub();
      bookingsUnsub();
    };
  }, []);

  const drivers = users.filter(u => u.role === "driver" && u.status === "active");
  const riders = users.filter(u => u.role === "rider");
  const admins = users.filter(u => u.role === "admin");

  const approveUser = async (user) => {
    if (window.confirm(`Approve ${user.name}?`)) {
      try {
        // Update user status to active
        await updateDoc(doc(db, "users", user.id), { status: "active" });

        // Notify user in-app
        await addDoc(collection(db, "notifications"), {
          userId: user.id,
          type: "account_approved",
          message: `Your ${user.role} account has been approved! You can now login.`,
          createdAt: new Date().toISOString(),
          read: false,
        });

        alert("User approved! Click OK to send email notification.");
        
        // Open email client to send approval email
        const subject = "Your Trivo Account is Approved!";
        const body = `Hi ${user.name},\n\nYour ${user.role} account has been approved!\n\nYou can now login at: https://trip-app-f2dc4.web.app\n\nBest regards,\nTrivo Admin Team`;
        window.open(`mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        
      } catch (error) {
        alert("Error approving user: " + error.message);
      }
    }
  };

  const declineUser = async (user) => {
    if (window.confirm(`Decline ${user.name}'s request?`)) {
      // Delete user from Firebase
      await deleteDoc(doc(db, "users", user.id));
      alert("User request declined and removed.");
    }
  };

  const [editingLine, setEditingLine] = useState(null);

  const startEditLine = (line) => {
    setEditingLine(line);
    setLineName(line.name);
    setPickPoints(line.pickPoints);
    setDestinations(line.destinations);
    setAssignedDriver(line.driverId);
    setTripTime(line.tripTime);
    setMaxSeats(line.maxSeats || 10);
    setShowLineForm(true);
  };

  const updateLine = async () => {
    if (!lineName || !assignedDriver) {
      alert("Fill all fields");
      return;
    }

    const validPickPoints = pickPoints.filter(p => p.trim());
    const validDestinations = destinations.filter(d => d.trim());

    try {
      await updateDoc(doc(db, "lines", editingLine.id), {
        name: lineName,
        pickPoints: validPickPoints,
        destinations: validDestinations,
        driverId: assignedDriver,
        tripTime,
        maxSeats,
      });

      await updateDoc(doc(db, "users", assignedDriver), {
        assignedLine: lineName,
      });

      alert("Line updated!");
      setShowLineForm(false);
      setEditingLine(null);
      resetLineForm();
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const deleteBooking = async (bookingId) => {
    if (window.confirm("Delete this booking? This will permanently remove it from Firebase.")) {
      try {
        await deleteDoc(doc(db, "bookings", bookingId));
        
        console.log("Booking deleted:", bookingId);
        alert("Booking deleted successfully from Firebase!");
      } catch (error) {
        console.error("Delete error:", error);
        alert("Error deleting booking: " + error.message);
      }
    }
  };

  const addPickPoint = () => setPickPoints([...pickPoints, ""]);
  const addDestination = () => setDestinations([...destinations, ""]);
  
  const updatePickPoint = (index, value) => {
    const updated = [...pickPoints];
    updated[index] = value;
    setPickPoints(updated);
  };

  const updateDestination = (index, value) => {
    const updated = [...destinations];
    updated[index] = value;
    setDestinations(updated);
  };

  const createLine = async () => {
    if (!lineName || !assignedDriver) {
      alert("Please fill line name and assign a driver");
      return;
    }

    const validPickPoints = pickPoints.filter(p => p.trim());
    const validDestinations = destinations.filter(d => d.trim());

    if (validPickPoints.length === 0 || validDestinations.length === 0) {
      alert("Add at least one pick-point and destination");
      return;
    }

    try {
      await addDoc(collection(db, "lines"), {
        name: lineName,
        pickPoints: validPickPoints,
        destinations: validDestinations,
        driverId: assignedDriver,
        tripTime,
        maxSeats,
        allowMultipleCars,
        createdAt: new Date().toISOString(),
        isActive: true,
      });

      await updateDoc(doc(db, "users", assignedDriver), {
        assignedLine: lineName,
      });

      alert("Line created successfully!");
      setShowLineForm(false);
      resetLineForm();
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const resetLineForm = () => {
    setLineName("");
    setPickPoints([""]);
    setDestinations([""]);
    setAssignedDriver("");
    setTripTime("08:00");
    setMaxSeats(10);
    setAllowMultipleCars(false);
  };

  const deleteLine = async (lineId) => {
    if (window.confirm("Delete this line? This will permanently remove it from Firebase.")) {
      try {
        await deleteDoc(doc(db, "lines", lineId));
        
        console.log("Line deleted:", lineId);
        alert("Line deleted successfully from Firebase!");
      } catch (error) {
        console.error("Delete error:", error);
        alert("Error deleting line: " + error.message);
      }
    }
  };

  const deleteUser = async (userId) => {
    if (window.confirm("Delete this user? This will permanently remove them from Firebase.")) {
      try {
        // Delete from Firestore
        await deleteDoc(doc(db, "users", userId));
        
        // Note: To delete from Authentication, user must delete their own account
        // OR admin must use Firebase Admin SDK (backend only)
        // For now, just delete from Firestore
        
        console.log("User deleted from Firestore:", userId);
        alert("User deleted from database! (Authentication remains - delete manually from Firebase Console → Authentication)");
      } catch (error) {
        console.error("Delete error:", error);
        alert("Error deleting user: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Dashboard 👨‍💼</h1>
        <div style={{display: 'flex', gap: '10px'}}>
          <button className="btn-primary" onClick={() => setShowProfile(!showProfile)}>👤</button>
          <button className="btn-logout" onClick={handleLogout}>{t('logout')}</button>
        </div>
      </div>

      {showProfile && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{background: 'white', padding: '30px', borderRadius: '10px', maxWidth: '400px', width: '90%'}}>
            <h2>{t('profile')}</h2>
            <p><strong>Name:</strong> {adminInfo?.name}</p>
            <p><strong>Email:</strong> {adminInfo?.email}</p>
            <p><strong>Role:</strong> {t('admin')}</p>
            <button className="btn-primary" onClick={() => setShowProfile(false)}>Close</button>
          </div>
        </div>
      )}

      {pendingUsers.length > 0 && (
        <div style={{background: '#fff3cd', padding: '15px', margin: '20px', borderRadius: '8px', border: '1px solid #ffc107'}}>
          <h3>⚠️ Pending User Requests ({pendingUsers.length})</h3>
          {pendingUsers.map(user => (
            <div key={user.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'white', margin: '10px 0', borderRadius: '5px'}}>
              <div>
                <strong>{user.name}</strong> ({user.role})
                <br />
                <small>📧 {user.email} | 📞 {user.phone}</small>
              </div>
              <div style={{display: 'flex', gap: '10px'}}>
                <button className="btn-primary" onClick={() => approveUser(user)}>✅ {t('approve')}</button>
                <button className="btn-delete" onClick={() => declineUser(user)}>❌ {t('decline')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card" onClick={() => { setActiveTab("users"); setUserFilter("driver"); }}>
          <div className="stat-icon">🚗</div>
          <div className="stat-info">
            <h3>{drivers.length}</h3>
            <p>Drivers</p>
          </div>
        </div>

        <div className="stat-card" onClick={() => { setActiveTab("users"); setUserFilter("rider"); }}>
          <div className="stat-icon">🧍</div>
          <div className="stat-info">
            <h3>{riders.length}</h3>
            <p>Riders</p>
          </div>
        </div>

        <div className="stat-card" onClick={() => { setActiveTab("users"); setUserFilter("admin"); }}>
          <div className="stat-icon">👨‍💼</div>
          <div className="stat-info">
            <h3>{admins.length}</h3>
            <p>Admins</p>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab("lines")}>
          <div className="stat-icon">🛣️</div>
          <div className="stat-info">
            <h3>{lines.length}</h3>
            <p>Lines</p>
          </div>
        </div>

        <div className="stat-card" onClick={() => setActiveTab("bookings")}>
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{bookings.length}</h3>
            <p>Bookings</p>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={activeTab === "users" ? "tab active" : "tab"} onClick={() => setActiveTab("users")}>{t('users')}</button>
        <button className={activeTab === "lines" ? "tab active" : "tab"} onClick={() => setActiveTab("lines")}>{t('lines')}</button>
        <button className={activeTab === "bookings" ? "tab active" : "tab"} onClick={() => setActiveTab("bookings")}>Bookings</button>
      </div>

      {activeTab === "users" && (
        <div className="section">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2>
              {userFilter === "all" ? "All Users" : userFilter === "driver" ? "Drivers" : userFilter === "rider" ? "Riders" : "Admins"}
            </h2>
            <button className="btn-small" onClick={() => setUserFilter("all")}>Show All</button>
          </div>
          <div className="users-list">
            {users
              .filter(u => userFilter === "all" || u.role === userFilter)
              .filter(u => u.status === "active")
              .map(user => (
              <div key={user.id} className="user-item">
                <div>
                  <h3>{user.name}</h3>
                  <p>📧 {user.email}</p>
                  <p>📞 {user.phone}</p>
                  <p><strong>Role:</strong> {user.role}</p>
                  {user.assignedLine && <p><strong>Line:</strong> {user.assignedLine}</p>}
                </div>
                <button className="btn-delete" onClick={() => deleteUser(user.id)}>🗑️</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "lines" && (
        <div className="section">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2>Lines</h2>
            <button className="btn-primary" onClick={() => {
              setShowLineForm(!showLineForm);
              setEditingLine(null);
              resetLineForm();
            }}>
              {showLineForm ? "Cancel" : "+ Create Line"}
            </button>
          </div>

          {showLineForm && (
            <div className="line-form">
              <h3>{editingLine ? "Edit Line" : "Create New Line"}</h3>
              
              <input
                placeholder="Line Name (e.g., Line A)"
                value={lineName}
                onChange={(e) => setLineName(e.target.value)}
                className="input-field"
              />

              <label><strong>Pick Points:</strong></label>
              {pickPoints.map((point, i) => (
                <input
                  key={i}
                  placeholder={`Pick Point ${i + 1}`}
                  value={point}
                  onChange={(e) => updatePickPoint(i, e.target.value)}
                  className="input-field"
                />
              ))}
              <button className="btn-small" onClick={addPickPoint}>+ Add Pick Point</button>

              <label><strong>Destinations:</strong></label>
              {destinations.map((dest, i) => (
                <input
                  key={i}
                  placeholder={`Destination ${i + 1}`}
                  value={dest}
                  onChange={(e) => updateDestination(i, e.target.value)}
                  className="input-field"
                />
              ))}
              <button className="btn-small" onClick={addDestination}>+ Add Destination</button>

              <label><strong>Assign Driver:</strong></label>
              <select value={assignedDriver} onChange={(e) => setAssignedDriver(e.target.value)} className="input-field">
                <option value="">Select Driver</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>

              <label><strong>Trip Time:</strong></label>
              <input
                type="time"
                value={tripTime}
                onChange={(e) => setTripTime(e.target.value)}
                className="input-field"
              />

              <label><strong>Max Seats:</strong></label>
              <input
                type="number"
                min="1"
                value={maxSeats}
                onChange={(e) => setMaxSeats(parseInt(e.target.value))}
                className="input-field"
              />

              <label style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px'}}>
                <input
                  type="checkbox"
                  checked={allowMultipleCars}
                  onChange={(e) => setAllowMultipleCars(e.target.checked)}
                />
                <strong>Allow multiple cars (auto-assign drivers when full)</strong>
              </label>

              <button className="btn-submit" onClick={editingLine ? updateLine : createLine}>
                {editingLine ? "Update Line" : "Create Line"}
              </button>
            </div>
          )}

          <div className="lines-list">
            {lines.map(line => (
              <div key={line.id} className="line-item">
                <div>
                  <h3>{line.name}</h3>
                  <p><strong>Pick Points:</strong> {line.pickPoints.join(", ")}</p>
                  <p><strong>Destinations:</strong> {line.destinations.join(", ")}</p>
                  <p><strong>Driver:</strong> {users.find(u => u.id === line.driverId)?.name || "Unassigned"}</p>
                  <p><strong>Time:</strong> {line.tripTime}</p>
                  <p><strong>Seats:</strong> {line.maxSeats || 10}</p>
                </div>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button className="btn-primary" onClick={() => startEditLine(line)}>✏️</button>
                  <button className="btn-delete" onClick={() => deleteLine(line.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "bookings" && (
        <div className="section">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <h2>All Bookings</h2>
            <input 
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input-field"
              style={{width: '200px'}}
              placeholder="Filter by date"
            />
          </div>
          <div className="bookings-list">
            {bookings
              .filter(booking => !dateFilter || booking.tripDate === dateFilter)
              .map(booking => (
              <div key={booking.id} className="booking-item">
                <div>
                  <h3>{booking.riderName}</h3>
                  <p>📞 {booking.riderPhone}</p>
                  <p><strong>Line:</strong> {booking.lineName}</p>
                  <p><strong>Pick:</strong> {booking.pickup}</p>
                  <p><strong>Dest:</strong> {booking.destination}</p>
                  <p><strong>Date:</strong> {booking.tripDate}</p>
                </div>
                <button className="btn-delete" onClick={() => deleteBooking(booking.id)}>🗑️</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}