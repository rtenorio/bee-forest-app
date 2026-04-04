import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ApiariesPage } from './pages/Apiaries/ApiariesPage';
import { ApiaryDetail } from './pages/Apiaries/ApiaryDetail';
import { HivesPage } from './pages/Hives/HivesPage';
import { HiveDetail } from './pages/Hives/HiveDetail';
import { PrintLabelsPage } from './pages/Hives/PrintLabelsPage';
import { InspectionsPage } from './pages/Inspections/InspectionsPage';
import { ColonyInspectionPage } from './pages/Inspections/ColonyInspectionPage';
import { ProductionsPage } from './pages/Productions/ProductionsPage';
import { FeedingsPage } from './pages/Feedings/FeedingsPage';
import { HarvestsPage } from './pages/Harvests/HarvestsPage';
import { HarvestWizard } from './pages/Harvests/HarvestWizard';
import { HarvestDetail } from './pages/Harvests/HarvestDetail';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import LoginPage from './pages/Login/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { QRScanPage } from './pages/QRScan/QRScanPage';
import { HiveLandingPage } from './pages/HiveLanding/HiveLandingPage';
import { TracePage } from './pages/Trace/TracePage';
import { UsersPage } from './pages/Users/UsersPage';
import { UserDetail } from './pages/Users/UserDetail';
import { SocioDashboard } from './pages/Dashboard/SocioDashboard';
import { ResponsavelDashboard } from './pages/Dashboard/ResponsavelDashboard';
import { TratadorDashboard } from './pages/Dashboard/TratadorDashboard';
import { useAuthStore } from './store/authStore';

function RoleDashboard() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'responsavel') return <ResponsavelDashboard />;
  if (role === 'tratador') return <TratadorDashboard />;
  return <SocioDashboard />; // socio + master_admin
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Páginas públicas — sem autenticação */}
      <Route path="h/:codigo" element={<HiveLandingPage />} />
      <Route path="trace/:codigo" element={<TracePage />} />

      <Route element={<ProtectedRoute />}>
        {/* Full-screen pages (no AppShell chrome) */}
        <Route path="inspections/new" element={<ColonyInspectionPage />} />
        <Route path="harvests/new" element={<HarvestWizard />} />
        <Route path="scan" element={<QRScanPage />} />

        <Route element={<AppShell />}>
          <Route index element={<RoleDashboard />} />
          <Route path="apiaries" element={<ApiariesPage />} />
          <Route path="apiaries/:id" element={<ApiaryDetail />} />
          <Route path="hives" element={<HivesPage />} />
          <Route path="hives/print-labels" element={<PrintLabelsPage />} />
          <Route path="hives/:id" element={<HiveDetail />} />
          <Route path="inspections" element={<InspectionsPage />} />
          <Route path="productions" element={<ProductionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="feedings" element={<FeedingsPage />} />
          <Route path="harvests" element={<HarvestsPage />} />
          <Route path="harvests/:id" element={<HarvestDetail />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
