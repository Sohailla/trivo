import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import "./DriverDashboard.css";

export default function DriverDashboard() {
  const [isSharing, setIsSharing] = useState(false);
  const [driverInfo, setDriverInfo] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState("");

  // Get driver info on mount
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
    if (!isSharing) return;

    const tripRef = doc(db, "tripLines", "TI8uTS4mXODTyDW6V5rO");

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        setCurrentLocation({ lat: latitude, lng: longitude });
        
        try {
          // Update driver location
          await updateDoc(tripRef, {
            driverLocation: {
              lat: latitude,
              lng: longitude,
            },
            driverName: driverInfo?.name || "Driver",
            driverPhone: driverInfo?.phone || "N/A",
            lastUpdated: new Date().toISOString(),
            isActive: true,
          });
          setError("");
        } catch (err) {
          // If document doesn't exist, create it
          if (err.code === "not-found") {
            await setDoc(tripRef, {
              driverLocation: {
                lat: latitude,
                lng: longitude,
              },
              driverName: driverInfo?.name || "Driver",
              driverPhone: driverInfo?.phone || "N/A",
              lastUpdated: new Date().toISOString(),
              isActive: true,
            });
          } else {
            setError("Error updating location: " + err.message);
          }
        }
      },
      (err) => {
        setError("Location error: " + err.message);
        console.error(err);
      },
      { 
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      // Mark as inactive when stopping
      updateDoc(tripRef, { isActive: false }).catch(console.error);
    };
  }, [isSharing, driverInfo]);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Driver Dashboard 🚗</h1>
        <button className="btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {driverInfo && (
        <div className="info-card">
          <p><strong>Name:</strong> {driverInfo.name}</p>
          <p><strong>Phone:</strong> {driverInfo.phone}</p>
        </div>
      )}

      <div className="status-section">
        <button
          className={isSharing ? "btn-stop" : "btn-start"}
          onClick={() => setIsSharing(!isSharing)}
        >
          {isSharing ? "Stop Trip ❌" : "Start Trip 🚀"}
        </button>

        {isSharing && (
          <div className="status-active">
            <div className="pulse"></div>
            <span>Trip Active - Sharing Location</span>
          </div>
        )}
      </div>

      {currentLocation && isSharing && (
        <div className="location-card">
          <h3>Current Location 📍</h3>
          <p>Lat: {currentLocation.lat.toFixed(6)}</p>
          <p>Lng: {currentLocation.lng.toFixed(6)}</p>
        </div>
      )}

      {error && (
        <div className="error-card">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}