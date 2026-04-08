import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    activeDrivers: 0,
    totalRiders: 0,
  });

  useEffect(() => {
    // Listen to bookings
    const bookingsUnsub = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const bookingsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBookings(bookingsList);
      
      // Calculate stats
      setStats(prev => ({
        ...prev,
        totalBookings: bookingsList.length,
        pendingBookings: bookingsList.filter(b => b.status === "pending").length,
      }));
    });

    // Listen to users for drivers/riders count
    const usersUnsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const driversList = users.filter(u => u.role === "driver");
      const ridersList = users.filter(u => u.role === "rider");
      
      setDrivers(driversList);
      setRiders(ridersList);
      
      setStats(prev => ({
        ...prev,
        activeDrivers: driversList.length,
        totalRiders: ridersList.length,
      }));
    });

    return () => {
      bookingsUnsub();
      usersUnsub();
    };
  }, []);

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      alert("Error updating booking: " + error.message);
    }
  };

  const deleteBooking = async (bookingId) => {
    if (window.confirm("Are you sure you want to delete this booking?")) {
      try {
        await deleteDoc(doc(db, "bookings", bookingId));
      } catch (error) {
        alert("Error deleting booking: " + error.message);
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
        <button className="btn-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{stats.totalBookings}</h3>
            <p>Total Bookings</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>{stats.pendingBookings}</h3>
            <p>Pending</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🚗</div>
          <div className="stat-info">
            <h3>{stats.activeDrivers}</h3>
            <p>Drivers</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🧍</div>
          <div className="stat-info">
            <h3>{stats.totalRiders}</h3>
            <p>Riders</p>
          </div>
        </div>
      </div>

      <div className="bookings-section">
        <h2>All Bookings</h2>
        
        {bookings.length === 0 ? (
          <div className="empty-state">
            <p>No bookings yet</p>
          </div>
        ) : (
          <div className="bookings-list">
            {bookings.map((booking) => (
              <div key={booking.id} className="booking-item">
                <div className="booking-info">
                  <h3>{booking.riderName}</h3>
                  <p>📞 {booking.riderPhone}</p>
                  <p><strong>From:</strong> {booking.pickup}</p>
                  <p><strong>To:</strong> {booking.destination}</p>
                  <p className="booking-time">
                    {new Date(booking.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="booking-actions">
                  <select
                    value={booking.status}
                    onChange={(e) => updateBookingStatus(booking.id, e.target.value)}
                    className={`status-select status-${booking.status}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <button
                    className="btn-delete"
                    onClick={() => deleteBooking(booking.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}