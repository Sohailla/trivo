import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import "./RiderDashboard.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { doc, onSnapshot, collection, addDoc, query, where, getDocs, getDoc, deleteDoc, updateDoc } from "firebase/firestore";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

export default function RiderDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState("home");
  const [riderInfo, setRiderInfo] = useState(null);
  const [lines, setLines] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [driverLocation, setDriverLocation] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [bookingCounts, setBookingCounts] = useState({});
  // eslint-disable-next-line
  const [showLiveMap, setShowLiveMap] = useState(false);

  useEffect(() => {
    const fetchRiderInfo = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRiderInfo(docSnap.data());
        }
      }
    };
    fetchRiderInfo();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "lines"), (snapshot) => {
      setLines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchBookingCounts = async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const counts = {};
      for (const line of lines) {
        const q = query(
          collection(db, "bookings"),
          where("lineId", "==", line.id),
          where("tripDate", "==", tomorrowStr)
        );
        const snapshot = await getDocs(q);
        counts[line.id] = snapshot.size;
      }
      setBookingCounts(counts);
    };
    if (lines.length > 0) fetchBookingCounts();
  }, [lines]);

  useEffect(() => {
    const fetchBookings = async () => {
      const user = auth.currentUser;
      if (user) {
        const q = query(collection(db, "bookings"), where("riderId", "==", user.uid));
        const snapshot = await getDocs(q);
        setMyBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    };
    fetchBookings();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid),
      where("read", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const tomorrowBooking = myBookings.find(b => b.tripDate === tomorrowStr);
    if (tomorrowBooking) {
      const line = lines.find(l => l.id === tomorrowBooking.lineId);
      if (line) {
        const tripRef = doc(db, "tripLines", line.id);
        const unsubscribe = onSnapshot(tripRef, (doc) => {
          if (doc.exists() && doc.data().isActive) {
            setActiveDriver(doc.data());
            setDriverLocation(doc.data().driverLocation);
          }
        });
        return () => unsubscribe();
      }
    }
  }, [myBookings, lines]);

  const handleBooking = async () => {
    if (!selectedLine || !pickup || !destination) return alert("Fill all fields");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Check if seats available
    const maxSeats = selectedLine.maxSeats || 10;
    const currentBookings = bookingCounts[selectedLine.id] || 0;
    
    if (currentBookings >= maxSeats) {
      return alert("Sorry, this trip is fully booked!");
    }

    await addDoc(collection(db, "bookings"), {
      riderId: auth.currentUser.uid,
      riderName: riderInfo?.name,
      riderPhone: riderInfo?.phone,
      lineName: selectedLine.name,
      lineId: selectedLine.id,
      pickup,
      destination,
      tripDate: tomorrowStr,
      status: "confirmed",
      paymentMethod: "cash",
      createdAt: new Date().toISOString(),
    });

    // Notify driver
    await addDoc(collection(db, "notifications"), {
      userId: selectedLine.driverId,
      type: "new_booking",
      message: `${riderInfo?.name} booked your trip ${selectedLine.name} for ${tomorrowStr}`,
      tripId: selectedLine.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    alert("Booking confirmed! Payment: Cash");
    setPickup("");
    setDestination("");
    setSelectedLine(null);
    
    // Refresh bookings
    const q = query(collection(db, "bookings"), where("riderId", "==", auth.currentUser.uid));
    const snapshot = await getDocs(q);
    setMyBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const cancelBooking = async (booking) => {
    const tripTime = new Date(booking.tripDate + 'T' + lines.find(l => l.id === booking.lineId)?.tripTime);
    const oneHourBefore = new Date(tripTime - 60 * 60 * 1000);
    
    if (new Date() >= oneHourBefore) {
      return alert("Cannot cancel within 1 hour of trip time!");
    }

    if (window.confirm("Cancel this booking?")) {
      await deleteDoc(doc(db, "bookings", booking.id));
      alert("Booking cancelled");
      
      // Refresh bookings
      const q = query(collection(db, "bookings"), where("riderId", "==", auth.currentUser.uid));
      const snapshot = await getDocs(q);
      setMyBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  const handleNotificationClick = async (notif) => {
    if (notif.type === "trip_started") {
      setShowLiveMap(true);
      setActiveView("home");
    }
    // Mark as read
    await updateDoc(doc(db, "notifications", notif.id), { read: true });
  };

  const carIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
    iconSize: [40, 40],
  });

  return (
    <div className="dashboard-container">
      <div className="sidebar" style={{ left: sidebarOpen ? 0 : '-280px' }}>
        <div className="sidebar-header">
          <h2>🧍 Rider</h2>
          <button onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav>
          <button onClick={() => { setActiveView("home"); setSidebarOpen(false); }}>🏠 Home</button>
          <button onClick={() => { setActiveView("lines"); setSidebarOpen(false); }}>🛣️ Available Lines</button>
          <button onClick={() => { setActiveView("bookings"); setSidebarOpen(false); }}>📋 My Bookings</button>
          <button onClick={() => { setActiveView("profile"); setSidebarOpen(false); }}>👤 Profile</button>
          <button onClick={handleLogout}>🚪 Logout</button>
        </nav>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <h1>Rider Dashboard</h1>
          {notifications.length > 0 && <span className="notif-badge">{notifications.length}</span>}
        </div>

        {notifications.length > 0 && (
          <div className="notifications">
            {notifications.map(n => (
              <div 
                key={n.id} 
                className="notif-item" 
                onClick={() => handleNotificationClick(n)}
                style={{cursor: 'pointer'}}
              >
                🔔 {n.message}
              </div>
            ))}
          </div>
        )}

        {activeView === "home" && (
          <div className="home-view">
            <div className="welcome-card">
              <h2>Welcome, {riderInfo?.name}!</h2>
            </div>
            {activeDriver && driverLocation && (
              <div className="live-trip-alert">
                <h3>🚗 Your Trip is Active!</h3>
                <p>Driver: {activeDriver.driverName}</p>
                <MapContainer center={[driverLocation.lat, driverLocation.lng]} zoom={15} className="mini-map">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[driverLocation.lat, driverLocation.lng]} icon={carIcon}>
                    <Popup>{activeDriver.driverName}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            )}
          </div>
        )}

        {activeView === "lines" && (
          <div className="lines-view">
            <h2>Available Lines</h2>
            {lines.map(line => {
              const maxSeats = line.maxSeats || 10;
              const booked = bookingCounts[line.id] || 0;
              const available = maxSeats - booked;
              const isFull = available <= 0;

              return (
                <div 
                  key={line.id} 
                  className={`line-card ${isFull ? 'disabled' : ''}`}
                  onClick={() => !isFull && setSelectedLine(line)}
                  style={isFull ? {opacity: 0.6, cursor: 'not-allowed'} : {}}
                >
                  <h3>{line.name}</h3>
                  <p>🕐 {line.tripTime}</p>
                  <p>📍 {line.pickPoints.join(", ")}</p>
                  <p>🪑 {available}/{maxSeats} seats available</p>
                  {isFull && <p style={{color: 'red', fontWeight: 'bold'}}>FULL</p>}
                </div>
              );
            })}

            {selectedLine && (
              <div className="booking-modal">
                <div className="modal-content">
                  <button className="close-btn" onClick={() => setSelectedLine(null)}>✕</button>
                  <h2>Book {selectedLine.name}</h2>
                  
                  <select value={pickup} onChange={(e) => setPickup(e.target.value)} className="input-field">
                    <option value="">Select Pickup</option>
                    {selectedLine.pickPoints.map((p, i) => <option key={i} value={p}>{p}</option>)}
                  </select>

                  <select value={destination} onChange={(e) => setDestination(e.target.value)} className="input-field">
                    <option value="">Select Destination</option>
                    {selectedLine.destinations.map((d, i) => <option key={i} value={d}>{d}</option>)}
                  </select>

                  <p style={{background: '#f0f0f0', padding: '10px', borderRadius: '5px', marginTop: '10px'}}>
                    💵 <strong>Payment:</strong> Cash only
                  </p>

                  <button className="btn-submit" onClick={handleBooking}>Confirm Booking</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === "bookings" && (
          <div className="bookings-view">
            <h2>My Bookings</h2>
            {myBookings.map(booking => (
              <div key={booking.id} className="booking-card">
                <h3>{booking.lineName}</h3>
                <p>📍 {booking.pickup} → {booking.destination}</p>
                <p>📅 {booking.tripDate}</p>
                <p>Status: <span className="status-confirmed">{booking.status}</span></p>
                <button className="btn-cancel" onClick={() => cancelBooking(booking)}>Cancel</button>
              </div>
            ))}
          </div>
        )}

        {activeView === "profile" && (
          <div className="profile-view">
            <h2>My Profile</h2>
            <div className="profile-card">
              <p><strong>Name:</strong> {riderInfo?.name}</p>
              <p><strong>Email:</strong> {auth.currentUser?.email}</p>
              <p><strong>Phone:</strong> {riderInfo?.phone}</p>
              <button className="btn-primary" onClick={() => window.location.href = '/profile'}>Edit Profile</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}