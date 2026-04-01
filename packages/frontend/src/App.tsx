import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ApiariesPage } from './pages/Apiaries/ApiariesPage';
import { ApiaryDetail } from './pages/Apiaries/ApiaryDetail';
import { HivesPage } from './pages/Hives/HivesPage';
import { HiveDetail } from './pages/Hives/HiveDetail';
import { InspectionsPage } from './pages/Inspections/InspectionsPage';
import { InspectionForm } from './pages/Inspections/InspectionForm';
import { ProductionsPage } from './pages/Productions/ProductionsPage';
import { FeedingsPage } from './pages/Feedings/FeedingsPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { Modal } from './components/ui/Modal';
import LoginPage from './pages/Login/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { SocioDashboard } from './pages/Dashboard/SocioDashboard';
import { ResponsavelDashboard } from './pages/Dashboard/ResponsavelDashboard';
import { TratadorDashboard } from './pages/Dashboard/TratadorDashboard';
import { useAuthStore } from './store/authStore';

function RoleDashboard() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'responsavel') return <ResponsavelDashboard />;
  if (role === 'tratador') return <TratadorDashboard />;
  return <SocioDashboard />;
}

function NewInspectionRoute() {
  const navigate = useNavigate();
  const [open] = useState(true);
  return (
    <Modal open={open} onClose={() => navigate(-1)} title="Nova Inspeção" size="lg">
      <InspectionForm onSuccess={() => navigate(-1)} onCancel={() => navigate(-1)} />
    </Modal>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<RoleDashboard />} />
          <Route path="apiaries" element={<ApiariesPage />} />
          <Route path="apiaries/:id" element={<ApiaryDetail />} />
          <Route path="hives" element={<HivesPage />} />
          <Route path="hives/:id" element={<HiveDetail />} />
          <Route path="hives/new" element={<HivesPage />} />
          <Route path="inspections" element={<InspectionsPage />} />
          <Route path="inspections/new" element={<NewInspectionRoute />} />
          <Route path="productions" element={<ProductionsPage />} />
          <Route path="feedings" element={<FeedingsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
