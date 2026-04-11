import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import { useLanguage } from "./LanguageContext";
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
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState("home");
  const [riderInfo, setRiderInfo] = useState(null);
  const [lines, setLines] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [driverLocation, setDriverLocation] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [fullScreenMap, setFullScreenMap] = useState(false);

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
    if (!selectedLine || !pickup || !destination || !tripDate) return alert("Fill all fields");

    // Week-by-week booking: can only book current week until Thursday ends
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const selectedDate = new Date(tripDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Get current week end (Thursday)
    const currentWeekEnd = new Date(today);
    const daysUntilThursday = (4 - today.getDay() + 7) % 7;
    currentWeekEnd.setDate(today.getDate() + daysUntilThursday);
    
    // Get next week start (Friday after current week's Thursday)
    const nextWeekStart = new Date(currentWeekEnd);
    nextWeekStart.setDate(currentWeekEnd.getDate() + 1);
    
    // If selected date is in next week and today is not Friday yet
    if (selectedDate > currentWeekEnd && today.getDay() !== 5) {
      return alert("You can only book next week starting Friday!");
    }

    const maxSeats = selectedLine.maxSeats || 10;
    const bookingsQuery = query(
      collection(db, "bookings"),
      where("lineId", "==", selectedLine.id),
      where("tripDate", "==", tripDate)
    );
    const bookingsSnap = await getDocs(bookingsQuery);
    const currentBookings = bookingsSnap.size;
    
    if (currentBookings >= maxSeats && !selectedLine.allowMultipleCars) {
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
      tripDate,
      status: "confirmed",
      paymentMethod: "cash",
      createdAt: new Date().toISOString(),
    });

    // Notify driver
    await addDoc(collection(db, "notifications"), {
      userId: selectedLine.driverId,
      type: "new_booking",
      message: `${riderInfo?.name} booked your trip ${selectedLine.name} for ${tripDate}`,
      tripId: selectedLine.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    alert("Booking confirmed! Payment: Cash");
    setPickup("");
    setDestination("");
    setTripDate("");
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
      setFullScreenMap(true);
    }
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
          <button onClick={() => { setActiveView("home"); setSidebarOpen(false); }}>🏠 {t('home')}</button>
          <button onClick={() => { setActiveView("lines"); setSidebarOpen(false); }}>🛣️ {t('availableLines')}</button>
          <button onClick={() => { setActiveView("bookings"); setSidebarOpen(false); }}>📋 {t('myBookings')}</button>
          <button onClick={() => { setActiveView("profile"); setSidebarOpen(false); }}>👤 {t('profile')}</button>
          <button onClick={handleLogout}>🚪 {t('logout')}</button>
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
              <h2>{t('welcome')}, {riderInfo?.name}!</h2>
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
            <h2>{t('availableLines')}</h2>
            {lines.map(line => (
              <div key={line.id} className="line-card" onClick={() => setSelectedLine(line)}>
                <h3>{line.name}</h3>
                <p>🕐 {line.tripTime}</p>
                <p>📍 {line.pickPoints.join(", ")}</p>
                <p>🪑 {line.maxSeats || 10} seats per trip</p>
              </div>
            ))}

            {selectedLine && (
              <div className="booking-modal">
                <div className="modal-content">
                  <button className="close-btn" onClick={() => setSelectedLine(null)}>✕</button>
                  <h2>Book {selectedLine.name}</h2>
                  
                  <label style={{fontWeight: 'bold', marginTop: '10px', display: 'block'}}>Select Date</label>
                  <input 
                    type="date" 
                    value={tripDate} 
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                    onChange={(e) => setTripDate(e.target.value)} 
                    className="input-field"
                  />

                  <select value={pickup} onChange={(e) => setPickup(e.target.value)} className="input-field">
                    <option value="">Select Pickup</option>
                    {selectedLine.pickPoints.map((p, i) => <option key={i} value={p}>{p}</option>)}
                  </select>

                  <select value={destination} onChange={(e) => setDestination(e.target.value)} className="input-field">
                    <option value="">Select Destination</option>
                    {selectedLine.destinations.map((d, i) => <option key={i} value={d}>{d}</option>)}
                  </select>

                  <p style={{background: '#f0f0f0', padding: '10px', borderRadius: '5px', marginTop: '10px'}}>
                    🕐 <strong>Time:</strong> {selectedLine.tripTime}
                  </p>

                  <p style={{background: '#f0f0f0', padding: '10px', borderRadius: '5px', marginTop: '10px'}}>
                    💵 <strong>Payment:</strong> Cash only
                  </p>

                  <button 
                    className="btn-submit" 
                    onClick={handleBooking}
                  >
                    {t('confirmBooking')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === "bookings" && (
          <div className="bookings-view">
            <h2>{t('myBookings')}</h2>
            {myBookings.map(booking => (
              <div key={booking.id} className="booking-card">
                <h3>{booking.lineName}</h3>
                <p>📍 {booking.pickup} → {booking.destination}</p>
                <p>📅 {booking.tripDate}</p>
                <p>Status: <span className="status-confirmed">{booking.status}</span></p>
                <button className="btn-cancel" onClick={() => cancelBooking(booking)}>{t('cancel')}</button>
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

      {fullScreenMap && driverLocation && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'white'}}>
          <div style={{padding: '15px', background: '#4F46E5', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <h3>🚗 Live Tracking</h3>
              <p>Driver: {activeDriver?.driverName}</p>
            </div>
            <button onClick={() => setFullScreenMap(false)} style={{background: 'white', color: '#4F46E5', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}>✕ Close</button>
          </div>
          <MapContainer center={[driverLocation.lat, driverLocation.lng]} zoom={15} style={{height: 'calc(100vh - 80px)', width: '100%'}}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[driverLocation.lat, driverLocation.lng]} icon={carIcon}>
              <Popup>{activeDriver?.driverName}</Popup>
            </Marker>
          </MapContainer>
        </div>
      )}
    </div>
  );
}