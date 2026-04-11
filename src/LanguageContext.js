import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    // Login
    login: "Login",
    signup: "Sign Up",
    email: "Email",
    password: "Password",
    fullName: "Full Name",
    phone: "Phone Number",
    iAm: "I am a",
    rider: "Rider",
    driver: "Driver",
    admin: "Admin",
    createAccount: "Create Account",
    alreadyHaveAccount: "Already have an account?",
    dontHaveAccount: "Don't have an account?",
    
    // Dashboard
    home: "Home",
    profile: "Profile",
    logout: "Logout",
    welcome: "Welcome",
    
    // Driver
    myTrips: "My Trips",
    riders: "Riders",
    startTrip: "Start Trip",
    stopTrip: "Stop Trip",
    sharingLocation: "Sharing Location",
    activeLines: "Active Lines",
    tomorrowRiders: "Tomorrow's Riders",
    ridersBooked: "riders booked",
    myProfile: "My Profile",
    name: "Name",
    editProfile: "Edit Profile",
    driverDashboard: "Driver Dashboard",
    time: "Time",
    date: "Date",
    notTimeYet: "Not Time Yet",
    
    // Rider
    availableLines: "Available Lines",
    myBookings: "My Bookings",
    bookNow: "Book Now",
    pickup: "Pickup",
    destination: "Destination",
    confirmBooking: "Confirm Booking",
    cancel: "Cancel",
    riderDashboard: "Rider Dashboard",
    
    // Admin
    users: "Users",
    lines: "Lines",
    bookings: "Bookings",
    approve: "Approve",
    decline: "Decline",
    delete: "Delete",
    createLine: "Create Line",
    pendingRequests: "Pending Requests",
  },
  ar: {
    // تسجيل الدخول
    login: "تسجيل الدخول",
    signup: "إنشاء حساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    iAm: "أنا",
    rider: "راكب",
    driver: "سائق",
    admin: "مدير",
    createAccount: "إنشاء حساب",
    alreadyHaveAccount: "لديك حساب بالفعل؟",
    dontHaveAccount: "ليس لديك حساب؟",
    
    // لوحة التحكم
    home: "الرئيسية",
    profile: "الملف الشخصي",
    logout: "تسجيل الخروج",
    welcome: "مرحباً",
    
    // السائق
    myTrips: "رحلاتي",
    riders: "الركاب",
    startTrip: "بدء الرحلة",
    stopTrip: "إيقاف الرحلة",
    sharingLocation: "مشاركة الموقع",
    activeLines: "الخطوط النشطة",
    tomorrowRiders: "ركاب الغد",
    ridersBooked: "راكب محجوز",
    myProfile: "ملفي الشخصي",
    name: "الاسم",
    editProfile: "تعديل الملف الشخصي",
    driverDashboard: "لوحة السائق",
    time: "الوقت",
    date: "التاريخ",
    notTimeYet: "لم يحن الوقت بعد",
    
    // الراكب
    availableLines: "الخطوط المتاحة",
    myBookings: "حجوزاتي",
    bookNow: "احجز الآن",
    pickup: "نقطة الصعود",
    destination: "الوجهة",
    confirmBooking: "تأكيد الحجز",
    cancel: "إلغاء",
    riderDashboard: "لوحة الراكب",
    
    // المدير
    users: "المستخدمين",
    lines: "الخطوط",
    bookings: "الحجوزات",
    approve: "موافقة",
    decline: "رفض",
    delete: "حذف",
    createLine: "إنشاء خط",
    pendingRequests: "الطلبات المعلقة",
  }
};

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  const t = (key) => translations[language][key] || key;

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  return (
    <LanguageContext.Provider value={{ language, t, toggleLanguage }}>
      <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};