import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, addDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useLanguage } from "./LanguageContext";
import "./DriverDashboard.css";

export default function DriverDashboard() {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState("home");
  const [driverInfo, setDriverInfo] = useState(null);
  const [myTrips, setMyTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchDriverInfo = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setDriverInfo(docSnap.data());
        }
      }
    };
    fetchDriverInfo();
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
    if (!driverInfo) return;

    const q = query(collection(db, "lines"), where("driverId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const trips = [];
      for (const lineDoc of snapshot.docs) {
        const lineData = { id: lineDoc.id, ...lineDoc.data() };
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const bookingsQuery = query(
          collection(db, "bookings"),
          where("lineId", "==", lineDoc.id),
          where("tripDate", "==", tomorrowStr)
        );
        const bookingsSnap = await getDocs(bookingsQuery);
        const riders = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        trips.push({ ...lineData, riders, tripDate: tomorrowStr });
      }
      setMyTrips(trips);
    });

    return () => unsubscribe();
  }, [driverInfo]);

  const canStartTrip = (trip) => {
    const now = new Date();
    const [hours, minutes] = trip.tripTime.split(':');
    const tripTime = new Date();
    tripTime.setHours(parseInt(hours), parseInt(minutes), 0);
    return now >= new Date(tripTime - 30 * 60 * 1000);
  };

  const notifyRiders = async (trip) => {
    for (const rider of trip.riders) {
      await addDoc(collection(db, "notifications"), {
        userId: rider.riderId,
        type: "trip_started",
        message: `Your trip on ${trip.name} has started! Driver is sharing location.`,
        tripId: trip.id,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    const adminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "admin")));
    for (const adminDoc of adminsSnap.docs) {
      await addDoc(collection(db, "notifications"), {
        userId: adminDoc.id,
        type: "trip_started",
        message: `Driver ${driverInfo.name} started trip ${trip.name}`,
        tripId: trip.id,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  };

  const startTrip = async (trip) => {
    if (!canStartTrip(trip)) {
      alert("Trip time hasn't arrived yet!");
      return;
    }
    setSelectedTrip(trip);
    setIsSharing(true);
    await notifyRiders(trip);
  };

  useEffect(() => {
    if (!isSharing || !selectedTrip) return;

    const tripRef = doc(db, "tripLines", selectedTrip.id);
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        
        await setDoc(tripRef, {
          driverLocation: { lat: latitude, lng: longitude },
          driverName: driverInfo?.name,
          driverPhone: driverInfo?.phone,
          lineName: selectedTrip.name,
          lastUpdated: new Date().toISOString(),
          isActive: true,
        }, { merge: true });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      updateDoc(tripRef, { isActive: false }).catch(console.error);
    };
  }, [isSharing, selectedTrip, driverInfo]);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  const handleNotificationClick = async (notif) => {
    if (notif.type === "new_booking") {
      // Refresh trips first
      const q = query(collection(db, "lines"), where("driverId", "==", auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const trips = [];
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      for (const lineDoc of snapshot.docs) {
        const lineData = { id: lineDoc.id, ...lineDoc.data() };
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("lineId", "==", lineDoc.id),
          where("tripDate", "==", tomorrowStr)
        );
        const bookingsSnap = await getDocs(bookingsQuery);
        const riders = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        trips.push({ ...lineData, riders, tripDate: tomorrowStr });
      }
      
      setMyTrips(trips);
      setActiveView("trips");
      
      // Find and set trip after updating state
      setTimeout(() => {
        const trip = trips.find(t => t.id === notif.tripId);
        if (trip) setSelectedTrip(trip);
      }, 100);
    }
    await updateDoc(doc(db, "notifications", notif.id), { read: true });
  };

  return (
    <div className="dashboard-container">
      <div className="sidebar" style={{ left: sidebarOpen ? 0 : '-280px' }}>
        <div className="sidebar-header">
          <h2>🚗 Driver</h2>
          <button onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav>
          <button onClick={() => { setActiveView("home"); setSidebarOpen(false); }}>🏠 {t('home')}</button>
          <button onClick={() => { setActiveView("trips"); setSidebarOpen(false); }}>📋 {t('myTrips')}</button>
          <button onClick={() => { setActiveView("profile"); setSidebarOpen(false); }}>👤 {t('profile')}</button>
          <button onClick={handleLogout}>🚪 {t('logout')}</button>
        </nav>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <h1>Driver Dashboard</h1>
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
              <h2>{t('welcome')}, {driverInfo?.name}!</h2>
              <p>Phone: {driverInfo?.phone}</p>
            </div>
            <div className="quick-stats">
              <div className="stat-box">
                <h3>{myTrips.length}</h3>
                <p>Active Lines</p>
              </div>
              <div className="stat-box">
                <h3>{myTrips.reduce((sum, t) => sum + t.riders.length, 0)}</h3>
                <p>Tomorrow's Riders</p>
              </div>
            </div>
          </div>
        )}

        {activeView === "trips" && (
          <div className="trips-view">
            <h2>My Trips</h2>
            {myTrips.map(trip => (
              <div key={trip.id} className="trip-card" onClick={() => setSelectedTrip(trip)}>
                <h3>{trip.name}</h3>
                <p>🕐 {trip.tripTime}</p>
                <p>👥 {trip.riders.length} riders</p>
                <p>📅 {trip.tripDate}</p>
              </div>
            ))}
          </div>
        )}

        {activeView === "profile" && (
          <div className="profile-view">
            <h2>My Profile</h2>
            <div className="profile-card">
              <p><strong>Name:</strong> {driverInfo?.name}</p>
              <p><strong>Email:</strong> {auth.currentUser?.email}</p>
              <p><strong>Phone:</strong> {driverInfo?.phone}</p>
              <button className="btn-primary" onClick={() => window.location.href = '/profile'}>Edit Profile</button>
            </div>
          </div>
        )}

        {selectedTrip && (
          <div className="trip-detail-modal">
            <div className="modal-content">
              <button className="close-btn" onClick={() => setSelectedTrip(null)}>✕</button>
              <h2>{selectedTrip.name}</h2>
              <p><strong>Time:</strong> {selectedTrip.tripTime}</p>
              <p><strong>Date:</strong> {selectedTrip.tripDate}</p>
              
              <h3>Riders ({selectedTrip.riders.length})</h3>
              {selectedTrip.riders.map(rider => (
                <div key={rider.id} className="rider-item">
                  <p><strong>{rider.riderName}</strong></p>
                  <p>📞 {rider.riderPhone}</p>
                  <p>📍 {rider.pickup} → {rider.destination}</p>
                </div>
              ))}

              {!isSharing ? (
                <button 
                  className="btn-start"
                  onClick={() => startTrip(selectedTrip)}
                  disabled={!canStartTrip(selectedTrip)}
                >
                  {canStartTrip(selectedTrip) ? "Start Trip 🚀" : "Not Time Yet ⏰"}
                </button>
              ) : (
                <>
                  <button className="btn-stop" onClick={() => setIsSharing(false)}>Stop Trip ❌</button>
                  <div className="location-status">
                    <div className="pulse"></div>
                    <p>Sharing Location</p>
                  </div>
                  {currentLocation && (
                    <>
                      <p className="coords">📍 {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}</p>
                      <div style={{marginTop: '15px', height: '300px', borderRadius: '8px', overflow: 'hidden'}}>
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${currentLocation.lng-0.01},${currentLocation.lat-0.01},${currentLocation.lng+0.01},${currentLocation.lat+0.01}&layer=mapnik&marker=${currentLocation.lat},${currentLocation.lng}`}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}