
import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import { Layout } from './components/Layout';
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ServiceOrders = lazy(() => import('./pages/ServiceOrders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Portal = lazy(() => import('./pages/Portal'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const SalesProcurement = lazy(() => import('./pages/SalesProcurement'));
const ProductionScanTemplates = lazy(() => import('./pages/ProductionScanTemplates'));
const ProductionMES = lazy(() => import('./pages/ProductionMES'));
import { Permission } from './types';

// Updated to check permissions instead of roles
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredPermission?: Permission }> = ({ children, requiredPermission }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  // If specific permission is required, check it
  if (requiredPermission && !user.permissions.includes(requiredPermission)) {
    // If user has no access, redirect to dashboard or show unauthorized
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

const AppContent = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#102a20] flex items-center justify-center text-emerald-100"><div className="flex items-center gap-3 text-sm"><span className="h-2 w-2 rounded-full bg-[#55d68a] animate-pulse" />正在加载模块…</div></div>}>
    <Routes>
      <Route path="/portal" element={<Portal />} />
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<Navigate to="/dashboard" />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute requiredPermission="VIEW_DASHBOARD">
          <Dashboard />
        </ProtectedRoute>
      } />

      <Route path="/orders" element={
        <ProtectedRoute requiredPermission="VIEW_ORDERS">
          <ServiceOrders />
        </ProtectedRoute>
      } />

      <Route path="/orders/:id" element={
        <ProtectedRoute requiredPermission="VIEW_ORDERS">
          <OrderDetail />
        </ProtectedRoute>
      } />

      <Route path="/production/mes" element={
        <ProtectedRoute requiredPermission="VIEW_PRODUCTION">
          <ProductionMES />
        </ProtectedRoute>
      } />

      {/* Legacy production routes now converge on the MES workbench */}
      <Route path="/production/list" element={
        <Navigate to="/production/mes" replace />
      } />
      <Route path="/production/entry" element={
        <Navigate to="/production/mes" replace />
      } />
      <Route path="/production/scan-templates" element={<ProtectedRoute requiredPermission="MANAGE_SCAN_TEMPLATE"><ProductionScanTemplates /></ProtectedRoute>} />
      
      {/* Legacy redirect for old bookmarks */}
      <Route path="/production" element={<Navigate to="/production/mes" />} />

      <Route path="/admin" element={
        <ProtectedRoute requiredPermission="MANAGE_SYSTEM">
          <AdminPanel />
        </ProtectedRoute>
      } />
      <Route path="/sales-procurement" element={
        <ProtectedRoute requiredPermission="MANAGE_SALES">
          <SalesProcurement />
        </ProtectedRoute>
      } />
      <Route path="/procurement" element={
        <ProtectedRoute requiredPermission="MANAGE_PROCUREMENT">
          <SalesProcurement />
        </ProtectedRoute>
      } />
    </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
