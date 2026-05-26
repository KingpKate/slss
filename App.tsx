
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServiceOrders from './pages/ServiceOrders';
import OrderDetail from './pages/OrderDetail';
import ProductionEntry from './pages/ProductionImport';
import ProductionQuery from './pages/ProductionList';
import ProductionRepair from './pages/ProductionRepair';
import ProcessDesigner from './pages/ProcessDesigner';
import DynamicProcessList from './pages/DynamicProcessList';
import Portal from './pages/Portal';
import AdminPanel from './pages/AdminPanel';
import { Permission } from './types';

// V2.0 Financial Pages
import FinanceDashboard from './pages/finance/FinanceDashboard';
import QuotationList from './pages/finance/QuotationList';
import QuotationDetail from './pages/finance/QuotationDetail';
import PurchaseOrderList from './pages/finance/PurchaseOrderList';
import PurchaseOrderDetail from './pages/finance/PurchaseOrderDetail';
import SettlementList from './pages/finance/SettlementList';
import SettlementDetail from './pages/finance/SettlementDetail';
import PaymentReview from './pages/finance/PaymentReview';

// V2.0 Enhanced Production Pages
import ScanTemplateManager from './pages/production/ScanTemplateManager';
import ScanEntry from './pages/production/ScanEntry';
import ShippingManager from './pages/production/ShippingManager';
import ProductionSettings from './pages/production/ProductionSettings';
import QualityDashboard from './pages/production/QualityDashboard';
import SopManager from './pages/production/SopManager';
import WorkstationManager from './pages/production/WorkstationManager';
import RoutingManager from './pages/production/RoutingManager';
import WorkOrderList from './pages/production/WorkOrderList';
import SchedulingBoard from './pages/production/SchedulingBoard';
import InspectionManager from './pages/production/InspectionManager';
import SPCDashboard from './pages/production/SPCDashboard';

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredPermission?: Permission; requiredPermissions?: Permission[] }> = ({ children, requiredPermission, requiredPermissions }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredPermission && !user.permissions.includes(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requiredPermissions && !requiredPermissions.some(p => user.permissions.includes(p))) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Layout>{children}</Layout>;
};

const AppContent = () => {
  return (
    <Routes>
      <Route path="/portal" element={<Portal />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />

      <Route path="/dashboard" element={
        <ProtectedRoute requiredPermission="VIEW_DASHBOARD">
          <Dashboard />
        </ProtectedRoute>
      } />

      {/* ============ After Sales Service ============ */}
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

      {/* Dynamic Process Routes */}
      <Route path="/process/:module/:templateId" element={
        <ProtectedRoute requiredPermission="VIEW_ORDERS">
           <DynamicProcessList />
        </ProtectedRoute>
      } />

      {/* ============ V2.0 Financial Module ============ */}
      <Route path="/finance" element={
        <ProtectedRoute requiredPermission="FIN_VIEW_DASHBOARD">
          <FinanceDashboard />
        </ProtectedRoute>
      } />

      <Route path="/finance/quotations" element={
        <ProtectedRoute requiredPermission="FIN_VIEW_QUOTATION">
          <QuotationList />
        </ProtectedRoute>
      } />

      <Route path="/finance/quotations/:id" element={
        <ProtectedRoute requiredPermission="FIN_VIEW_QUOTATION">
          <QuotationDetail />
        </ProtectedRoute>
      } />

      <Route path="/finance/purchase-orders" element={
        <ProtectedRoute requiredPermission="FIN_PROCUREMENT_EXECUTE">
          <PurchaseOrderList />
        </ProtectedRoute>
      } />

      <Route path="/finance/purchase-orders/:id" element={
        <ProtectedRoute requiredPermission="FIN_PROCUREMENT_EXECUTE">
          <PurchaseOrderDetail />
        </ProtectedRoute>
      } />

      <Route path="/finance/settlements" element={
        <ProtectedRoute requiredPermission="FIN_SETTLEMENT">
          <SettlementList />
        </ProtectedRoute>
      } />

      <Route path="/finance/settlements/:id" element={
        <ProtectedRoute requiredPermission="FIN_SETTLEMENT">
          <SettlementDetail />
        </ProtectedRoute>
      } />

      <Route path="/finance/payments" element={
        <ProtectedRoute requiredPermission="FIN_PAYMENT_REVIEW">
          <PaymentReview />
        </ProtectedRoute>
      } />

      {/* ============ V2.0 Enhanced Production ============ */}
      <Route path="/production/entry" element={
        <ProtectedRoute requiredPermissions={['PROD_ENTRY_ASSEMBLY', 'PROD_ENTRY_INSPECT_INIT', 'PROD_ENTRY_AGING', 'PROD_ENTRY_INSPECT_FINAL']}>
          <ProductionEntry />
        </ProtectedRoute>
      } />

      <Route path="/production/scan-entry" element={
        <ProtectedRoute requiredPermissions={['PROD_ENTRY_ASSEMBLY', 'PROD_ENTRY_INSPECT_INIT']}>
          <ScanEntry />
        </ProtectedRoute>
      } />

      <Route path="/production/repair" element={
        <ProtectedRoute requiredPermission="PROD_REPAIR">
          <ProductionRepair />
        </ProtectedRoute>
      } />

      <Route path="/production/list" element={
        <ProtectedRoute requiredPermission="PROD_QUERY">
          <ProductionQuery />
        </ProtectedRoute>
      } />

      <Route path="/production/shipping" element={
        <ProtectedRoute requiredPermission="PROD_SHIPPING">
          <ShippingManager />
        </ProtectedRoute>
      } />

      <Route path="/production/quality" element={
        <ProtectedRoute requiredPermission="PROD_QUERY">
          <QualityDashboard />
        </ProtectedRoute>
      } />

      <Route path="/production/scan-templates" element={
        <ProtectedRoute requiredPermission="PROD_MANAGE_SCAN_TPL">
          <ScanTemplateManager />
        </ProtectedRoute>
      } />

      <Route path="/production/sop" element={
        <ProtectedRoute requiredPermission="PROD_SOP_MANAGE">
          <SopManager />
        </ProtectedRoute>
      } />

      <Route path="/production/settings" element={
        <ProtectedRoute requiredPermission="PROD_MANAGE_SETTINGS">
          <ProductionSettings />
        </ProtectedRoute>
      } />

      <Route path="/production/workstations" element={
        <ProtectedRoute requiredPermission="WS_VIEW">
          <WorkstationManager />
        </ProtectedRoute>
      } />

      <Route path="/production/routings" element={
        <ProtectedRoute requiredPermission="ROUTING_VIEW">
          <RoutingManager />
        </ProtectedRoute>
      } />

      <Route path="/production/work-orders" element={
        <ProtectedRoute requiredPermission="WO_VIEW">
          <WorkOrderList />
        </ProtectedRoute>
      } />

      <Route path="/production/scheduling" element={
        <ProtectedRoute requiredPermission="WO_SCHEDULE">
          <SchedulingBoard />
        </ProtectedRoute>
      } />

      <Route path="/production/inspections" element={
        <ProtectedRoute requiredPermission="INSP_VIEW">
          <InspectionManager />
        </ProtectedRoute>
      } />

      <Route path="/production/spc" element={
        <ProtectedRoute requiredPermission="SPC_VIEW">
          <SPCDashboard />
        </ProtectedRoute>
      } />

      <Route path="/production" element={<Navigate to="/production/entry" />} />

      {/* ============ Process Designer ============ */}
      <Route path="/process-designer" element={
        <ProtectedRoute requiredPermission="MANAGE_SYSTEM">
          <ProcessDesigner />
        </ProtectedRoute>
      } />

      {/* ============ Admin ============ */}
      <Route path="/admin" element={
        <ProtectedRoute requiredPermission="MANAGE_SYSTEM">
          <AdminPanel />
        </ProtectedRoute>
      } />
    </Routes>
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
