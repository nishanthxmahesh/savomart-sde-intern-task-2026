import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { AdminAuthProvider } from './hooks/useAdminAuth';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Offers from './pages/Offers';
import Stores from './pages/Stores';
import Support from './pages/Support';

// Admin
import AdminProtectedRoute from './admin/AdminProtectedRoute';
import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/pages/AdminDashboard';
import AdminOffers from './admin/pages/AdminOffers';
import AdminCoupons from './admin/pages/AdminCoupons';
import AdminPoints from './admin/pages/AdminPoints';
import AdminTickets, { AdminTicketDetail } from './admin/pages/AdminTickets';
import AdminUsers, { AdminUserDetail } from './admin/pages/AdminUsers';
import AdminAnalytics from './admin/pages/AdminAnalytics';

export default function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Customer app */}
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/offers"
                element={
                  <ProtectedRoute>
                    <Offers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/stores"
                element={
                  <ProtectedRoute>
                    <Stores />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/support"
                element={
                  <ProtectedRoute>
                    <Support />
                  </ProtectedRoute>
                }
              />

              {/* Admin */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <AdminProtectedRoute>
                    <AdminLayout />
                  </AdminProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="offers" element={<AdminOffers />} />
                <Route
                  path="coupons"
                  element={
                    <AdminProtectedRoute requireSuperadmin>
                      <AdminCoupons />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="points"
                  element={
                    <AdminProtectedRoute requireSuperadmin>
                      <AdminPoints />
                    </AdminProtectedRoute>
                  }
                />
                <Route path="tickets" element={<AdminTickets />} />
                <Route path="tickets/:publicId" element={<AdminTicketDetail />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:userId" element={<AdminUserDetail />} />
                <Route path="analytics" element={<AdminAnalytics />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}
