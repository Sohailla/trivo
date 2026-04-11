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
  const [showNotifications, setShowNotifications] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterLine, setFilterLine] = useState("");

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
      const tripsMap = new Map();
      
      for (const lineDoc of snapshot.docs) {
        const lineData = { id: lineDoc.id, ...lineDoc.data() };
        
        // Get all future bookings for this line
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("lineId", "==", lineDoc.id)
        );
        const bookingsSnap = await getDocs(bookingsQuery);
        
        // Group by date
        bookingsSnap.docs.forEach(doc => {
          const booking = doc.data();
          const dateKey = `${lineDoc.id}_${booking.tripDate}`;
          
          if (!tripsMap.has(dateKey)) {
            tripsMap.set(dateKey, {
              ...lineData,
              tripDate: booking.tripDate,
              riders: []
            });
          }
          
          tripsMap.get(dateKey).riders.push({ id: doc.id, ...booking });
        });
      }
      
      // Convert to array and sort by date
      const trips = Array.from(tripsMap.values()).sort((a, b) => 
        new Date(a.tripDate) - new Date(b.tripDate)
      );
      
      setMyTrips(trips);
    });

    return () => unsubscribe();
  }, [driverInfo]);

  const getTomorrowRiders = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    return myTrips
      .filter(trip => trip.tripDate === tomorrowStr)
      .reduce((sum, trip) => sum + (trip.riders?.length || 0), 0);
  };

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
      const q = query(collection(db, "lines"), where("driverId", "==", auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const tripsMap = new Map();
      
      for (const lineDoc of snapshot.docs) {
        const lineData = { id: lineDoc.id, ...lineDoc.data() };
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("lineId", "==", lineDoc.id)
        );
        const bookingsSnap = await getDocs(bookingsQuery);
        
        bookingsSnap.docs.forEach(doc => {
          const booking = doc.data();
          const dateKey = `${lineDoc.id}_${booking.tripDate}`;
          
          if (!tripsMap.has(dateKey)) {
            tripsMap.set(dateKey, {
              ...lineData,
              tripDate: booking.tripDate,
              riders: []
            });
          }
          
          tripsMap.get(dateKey).riders.push({ id: doc.id, ...booking });
        });
      }
      
      const trips = Array.from(tripsMap.values()).sort((a, b) => 
        new Date(a.tripDate) - new Date(b.tripDate)
      );
      
      setMyTrips(trips);
      setActiveView("trips");
      
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
          <h2>🚗 {t('driver')}</h2>
          <button onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav>
          <button onClick={() => { setActiveView("home"); setSidebarOpen(false); }}>🏠 {t('home')}</button>
          <button onClick={() => { setActiveView("trips"); setSidebarOpen(false); }}>📋 {t('myTrips')}</button>
          <button onClick={() => { setActiveView("riders"); setSidebarOpen(false); }}>👥 All Riders</button>
          <button onClick={() => { setActiveView("profile"); setSidebarOpen(false); }}>👤 {t('profile')}</button>
          <button onClick={handleLogout}>🚪 {t('logout')}</button>
        </nav>
      </div>

      <div className="main-content">
        <div className="top-bar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <h1>{t('driverDashboard')}</h1>
          {notifications.length > 0 && (
            <button 
              className="notif-badge" 
              onClick={() => setShowNotifications(!showNotifications)}
              style={{cursor: 'pointer', border: 'none'}}
            >
              🔔 {notifications.length}
            </button>
          )}
        </div>

        {showNotifications && notifications.length > 0 && (
          <div className="notifications">
            {notifications.map(n => (
              <div 
                key={n.id} 
                className="notif-item"
                onClick={() => {
                  handleNotificationClick(n);
                  setShowNotifications(false);
                }}
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
              <p>{t('phone')}: {driverInfo?.phone}</p>
            </div>
            <div className="quick-stats">
              <div className="stat-box" onClick={() => setActiveView("trips")} style={{cursor: 'pointer'}}>
                <h3>{new Set(myTrips.map(t => t.id)).size}</h3>
                <p>{t('activeLines')}</p>
              </div>
              <div className="stat-box" onClick={() => {
                setActiveView("riders");
                setFilterDate("");
                setFilterLine("");
              }} style={{cursor: 'pointer'}}>
                <h3>{myTrips.reduce((sum, trip) => sum + (trip.riders?.length || 0), 0)}</h3>
                <p>Total Riders</p>
              </div>
            </div>
          </div>
        )}

        {activeView === "trips" && (
          <div className="trips-view">
            <h2>{t('myTrips')}</h2>
            {myTrips.map(trip => (
              <div key={trip.id + trip.tripDate} className="trip-card" onClick={() => setSelectedTrip(trip)}>
                <h3>{trip.name}</h3>
                <p>🕐 {trip.tripTime}</p>
                <p>👥 {trip.riders.length} {t('ridersBooked')}</p>
                <p>📅 {trip.tripDate}</p>
              </div>
            ))}
          </div>
        )}

        {activeView === "riders" && (
          <div className="riders-view">
            <h2>All Riders</h2>
            <div style={{background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px'}}>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Filter by Date</label>
                  <input 
                    type="date" 
                    value={filterDate} 
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="input-field"
                    style={{margin: 0}}
                  />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Filter by Line</label>
                  <select 
                    value={filterLine} 
                    onChange={(e) => setFilterLine(e.target.value)}
                    className="input-field"
                    style={{margin: 0}}
                  >
                    <option value="">All Lines</option>
                    {[...new Set(myTrips.map(t => t.name))].map(lineName => (
                      <option key={lineName} value={lineName}>{lineName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button 
                onClick={() => {setFilterDate(""); setFilterLine("");}}
                style={{marginTop: '15px', padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'}}
              >
                Clear Filters
              </button>
            </div>
            
            {myTrips
              .filter(trip => !filterDate || trip.tripDate === filterDate)
              .filter(trip => !filterLine || trip.name === filterLine)
              .map(trip => (
                <div key={trip.id + trip.tripDate} className="trip-card" style={{cursor: 'default'}}>
                  <h3>{trip.name}</h3>
                  <p>📅 {trip.tripDate} | 🕐 {trip.tripTime}</p>
                  <p style={{fontWeight: 'bold', color: '#667eea', fontSize: '18px'}}>👥 {trip.riders.length} Riders</p>
                  {trip.riders.map(rider => (
                    <div key={rider.id} className="rider-item" style={{marginTop: '10px'}}>
                      <p><strong>{rider.riderName}</strong></p>
                      <p>📞 {rider.riderPhone}</p>
                      <p>📍 {rider.pickup} → {rider.destination}</p>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}

        {activeView === "profile" && (
          <div className="profile-view">
            <h2>{t('myProfile')}</h2>
            <div className="profile-card">
              <p><strong>{t('name')}:</strong> {driverInfo?.name}</p>
              <p><strong>{t('email')}:</strong> {auth.currentUser?.email}</p>
              <p><strong>{t('phone')}:</strong> {driverInfo?.phone}</p>
              <button className="btn-primary" onClick={() => window.location.href = '/profile'}>{t('editProfile')}</button>
            </div>
          </div>
        )}

        {selectedTrip && (
          <div className="trip-detail-modal">
            <div className="modal-content">
              <button className="close-btn" onClick={() => setSelectedTrip(null)}>✕</button>
              <h2>{selectedTrip.name}</h2>
              <p><strong>{t('time')}:</strong> {selectedTrip.tripTime}</p>
              <p><strong>{t('date')}:</strong> {selectedTrip.tripDate}</p>
              
              <h3>{t('riders')} ({selectedTrip.riders.length})</h3>
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
                  {canStartTrip(selectedTrip) ? t('startTrip') + " 🚀" : t('notTimeYet') + " ⏰"}
                </button>
              ) : (
                <>
                  <button className="btn-stop" onClick={async () => {
                    setIsSharing(false);
                    await updateDoc(doc(db, "tripLines", selectedTrip.id), { isActive: false });
                  }}>{t('stopTrip')} ❌</button>
                  <div className="location-status">
                    <div className="pulse"></div>
                    <p>{t('sharingLocation')}</p>
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