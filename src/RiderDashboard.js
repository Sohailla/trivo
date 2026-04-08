import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import "./RiderDashboard.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { doc, onSnapshot, collection, addDoc, query, where, getDocs, getDoc } from "firebase/firestore";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

export default function RiderDashboard() {
  const [driver, setDriver] = useState(null);
  const [location, setLocation] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [riderInfo, setRiderInfo] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  
  // Booking form
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");

  // Get rider info
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
    const fetchBookings = async () => {
      const user = auth.currentUser;
      if (user) {
        const q = query(
          collection(db, "bookings"),
          where("riderId", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const bookings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMyBookings(bookings);
      }
    };
    fetchBookings();
  }, [bookingStatus]);

  // Listen to driver location
  useEffect(() => {
    const ref = doc(db, "tripLines", "TI8uTS4mXODTyDW6V5rO");

    const unsub = onSnapshot(ref, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setDriver(data);
        setLocation(data?.driverLocation || null);
      }
    });

    return () => unsub();
  }, []);

  const carIcon = new L.Icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
    iconSize: [40, 40],
  });

  const handleBooking = async () => {
    if (!pickup || !destination) {
      setBookingStatus("Please fill all fields");
      return;
    }

    const user = auth.currentUser;
    
    try {
      await addDoc(collection(db, "bookings"), {
        riderId: user.uid,
        riderName: riderInfo?.name || "Rider",
        riderPhone: riderInfo?.phone || "N/A",
        pickup,
        destination,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      setBookingStatus("Booking created successfully! 🎉");
      setPickup("");
      setDestination("");
      
      setTimeout(() => {
        setShowBooking(false);
        setBookingStatus("");
      }, 2000);
    } catch (error) {
      setBookingStatus("Error: " + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Rider Dashboard 🧍</h1>
        <button className="btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {riderInfo && (
        <div className="rider-info">
          <p><strong>Welcome, {riderInfo.name}!</strong></p>
        </div>
      )}

      <div className="action-buttons">
        <button 
          className="btn-primary"
          onClick={() => setShowBooking(!showBooking)}
        >
          {showBooking ? "Cancel" : "Book a Ride 🚖"}
        </button>
      </div>

      {showBooking && (
        <div className="booking-form">
          <h3>Book Your Ride</h3>
          <input
            type="text"
            placeholder="📍 Pickup Location"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            className="input-field"
          />
          <input
            type="text"
            placeholder="🎯 Destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="input-field"
          />
          <button className="btn-submit" onClick={handleBooking}>
            Confirm Booking
          </button>
          {bookingStatus && (
            <div className={bookingStatus.includes("Error") ? "error" : "success"}>
              {bookingStatus}
            </div>
          )}
        </div>
      )}

      {myBookings.length > 0 && (
        <div className="bookings-section">
          <h3>My Bookings</h3>
          {myBookings.map((booking) => (
            <div key={booking.id} className="booking-card">
              <p><strong>From:</strong> {booking.pickup}</p>
              <p><strong>To:</strong> {booking.destination}</p>
              <p>
                <strong>Status:</strong>{" "}
                <span className={`status-${booking.status}`}>
                  {booking.status}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="live-tracking">
        <h3>Live Tracking 🗺️</h3>
        
        {driver && driver.isActive && (
          <div className="driver-card">
            <div className="driver-info">
              <p><b>Driver:</b> {driver.driverName}</p>
              <p><b>Phone:</b> {driver.driverPhone}</p>
            </div>
            <div className="status-badge active">
              <div className="pulse-dot"></div>
              Active
            </div>
          </div>
        )}

        {location && driver?.isActive ? (
          <div className="map-wrapper">
            <MapContainer
              center={[location.lat, location.lng]}
              zoom={15}
              className="map"
              key={`${location.lat}-${location.lng}`}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <Marker position={[location.lat, location.lng]} icon={carIcon}>
                <Popup>
                  <strong>{driver.driverName}</strong><br/>
                  Your driver is here!
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        ) : (
          <div className="no-driver">
            <p>🚫 No active driver nearby</p>
            <p className="hint">Driver hasn't started the trip yet</p>
          </div>
        )}
      </div>
    </div>
  );
}