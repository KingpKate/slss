
import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import { AppShell } from './components/app-shell/AppShell';
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ServiceOrders = lazy(() => import('./pages/ServiceOrders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Portal = lazy(() => import('./pages/Portal'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const SalesProcurement = lazy(() => import('./pages/SalesProcurement'));
const ProductionScanTemplates = lazy(() => import('./pages/ProductionScanTemplates'));
const ProductionMES = lazy(() => import('./pages/ProductionMES'));
const PerformanceEvaluation = lazy(() => import('./pages/PerformanceEvaluation'));
const QualityManagement = lazy(() => import('./pages/QualityManagement'));
import { Permission } from './types';

// Updated to check permissions instead of roles
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredPermission?: Permission }> = ({ children, requiredPermission }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  // If specific permission is required, check it
  const hasPermission = requiredPermission
    ? user.permissions.includes(requiredPermission)
      // Keep existing production users with the former management permission
      // able to access the performance workspace while VIEW_PERFORMANCE is
      // rolled out through the permission center.
      || (requiredPermission === 'VIEW_PERFORMANCE' && (user.permissions.includes('MANAGE_PERFORMANCE') || user.permissions.includes('MANAGE_SYSTEM')))
    : true;
  if (!hasPermission) {
    // If user has no access, redirect to dashboard or show unauthorized
    return <Navigate to="/dashboard" replace />;
  }
  
  return <AppShell>{children}</AppShell>;
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
      <Route path="/quality" element={<ProtectedRoute requiredPermission="VIEW_PRODUCTION"><QualityManagement /></ProtectedRoute>} />
      <Route path="/quality/inspection-orders" element={<ProtectedRoute requiredPermission="VIEW_PRODUCTION"><QualityManagement /></ProtectedRoute>} />
      <Route path="/quality/templates" element={<ProtectedRoute requiredPermission="VIEW_PRODUCTION"><QualityManagement /></ProtectedRoute>} />
      <Route path="/quality/templates/new" element={<ProtectedRoute requiredPermission="VIEW_PRODUCTION"><QualityManagement /></ProtectedRoute>} />
      <Route path="/quality/templates/general" element={<ProtectedRoute requiredPermission="VIEW_PRODUCTION"><QualityManagement /></ProtectedRoute>} />
      <Route path="/quality/templates/library/*" element={<ProtectedRoute requiredPermission="VIEW_PRODUCTION"><QualityManagement /></ProtectedRoute>} />
      <Route path="/quality/production-import/*" element={<ProtectedRoute requiredPermission="VIEW_PRODUCTION"><QualityManagement /></ProtectedRoute>} />
      <Route path="/hr/performance" element={
        <ProtectedRoute requiredPermission="VIEW_PERFORMANCE"><PerformanceEvaluation /></ProtectedRoute>
      } />
      <Route path="/performance" element={<Navigate to="/hr/performance" replace />} />

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
