import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { FirmProvider } from './hooks/useFirm';
import { DarkModeProvider } from './hooks/useDarkMode';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { useState } from 'react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TransactionEntry from './pages/TransactionEntry';
import TransactionTracking from './pages/TransactionTracking';
import StockManagement from './pages/StockManagement';
import StockUnitManagement from './pages/StockUnitManagement';
import StockMerge from './pages/StockMerge';
import CheckManagement from './pages/CheckManagement';
import CashManagement from './pages/CashManagement';
import BankManagement from './pages/BankManagement';
import Projects from './pages/Projects';
import AccountStatement from './pages/AccountStatement';
import Reports from './pages/Reports';
import Firms from './pages/Firms';
import Cariler from './pages/Cariler';
import FirmMerge from './pages/FirmMerge';
import UserManagement from './pages/UserManagement';
import OrderEntry from './pages/OrderEntry';
import OrderTracking from './pages/OrderTracking';
import PersonnelManagement from './pages/PersonnelManagement';
import AttendancePage from './pages/Attendance';
import PayrollPage from './pages/Payroll';
import LeaveManagement from './pages/LeaveManagement';
import SeverancePage from './pages/Severance';
import StockCount from './pages/StockCount';
import DueDateCalendar from './pages/DueDateCalendar';
import DocumentManagement from './pages/DocumentManagement';
import AssetManagement from './pages/AssetManagement';
import DeliveryNoteToInvoice from './pages/DeliveryNoteToInvoice';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header />
        
        <main className="p-4 lg:p-6 pb-20 lg:pb-6">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/islem-girisi" element={<TransactionEntry />} />
            <Route path="/islem-takibi" element={<TransactionTracking />} />
            <Route path="/siparis-girisi" element={<OrderEntry />} />
            <Route path="/siparis-takibi" element={<OrderTracking />} />
            <Route path="/stok" element={<StockManagement />} />
            <Route path="/stok-birimleri" element={<StockUnitManagement />} />
            <Route path="/stok-birlesme" element={<StockMerge />} />
            <Route path="/cekler" element={<CheckManagement />} />
            <Route path="/kasalar" element={<CashManagement />} />
            <Route path="/bankalar" element={<BankManagement />} />
            <Route path="/projeler" element={<Projects />} />
            <Route path="/cari-hesap" element={<AccountStatement />} />
            <Route path="/raporlar" element={<Reports />} />
            <Route path="/firmalar" element={<Firms />} />
            <Route path="/cariler" element={<Cariler />} />
            <Route path="/firma-birlesme" element={<FirmMerge />} />
            <Route path="/kullanici-yonetimi" element={<UserManagement />} />
            <Route path="/personel" element={<PersonnelManagement />} />
            <Route path="/puantaj" element={<AttendancePage />} />
            <Route path="/bordro" element={<PayrollPage />} />
            <Route path="/izin" element={<LeaveManagement />} />
            <Route path="/kidem-ihbar" element={<SeverancePage />} />
            <Route path="/stok-sayim" element={<StockCount />} />
            <Route path="/vade-takvimi" element={<DueDateCalendar />} />
            <Route path="/dokumanlar" element={<DocumentManagement />} />
            <Route path="/demirbaslar" element={<AssetManagement />} />
            <Route path="/irsaliye-fatura" element={<DeliveryNoteToInvoice />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      
      <MobileNav />
      <KeyboardShortcuts />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <FirmProvider>
        <DarkModeProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              />
          </Routes>
        </Router>
        </DarkModeProvider>
      </FirmProvider>
    </AuthProvider>
  );
}

export default App;