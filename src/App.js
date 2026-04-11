import Login from "./Login";
import "./firebase";
import "leaflet/dist/leaflet.css";
import { LanguageProvider, useLanguage } from './LanguageContext';

import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  
  return (
    <button 
      onClick={toggleLanguage}
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: '#4F46E5',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '5px',
        cursor: 'pointer',
        zIndex: 9999,
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}
    >
      {language === 'en' ? 'العربية' : 'English'}
    </button>
  );
}

function App() {
  return (
    <LanguageProvider>
      <LanguageToggle />
      <Login />
    </LanguageProvider>
  );
}

export default App;