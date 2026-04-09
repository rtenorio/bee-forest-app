import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ApiariesPage } from './pages/Apiaries/ApiariesPage';
import { ApiaryDetail } from './pages/Apiaries/ApiaryDetail';
import { HivesPage } from './pages/Hives/HivesPage';
import { HiveDetail } from './pages/Hives/HiveDetail';
import { PrintLabelsPage } from './pages/Hives/PrintLabelsPage';
import { PrintLabelsFullPage } from './pages/Hives/PrintLabelsFullPage';
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
import { BatchesPage } from './pages/Batches/BatchesPage';
import { BatchNewPage } from './pages/Batches/BatchNewPage';
import { BatchDetail } from './pages/Batches/BatchDetail';
import { BatchQualityPage } from './pages/Batches/BatchQualityPage';
import { BatchReportsPage } from './pages/Batches/BatchReportsPage';
import { NotificationsPage } from './pages/Notifications/NotificationsPage';
import { NotificationSettingsPage } from './pages/Notifications/NotificationSettingsPage';
import { StockPage } from './pages/Stock/StockPage';
import { StockApiaryPage } from './pages/Stock/StockApiaryPage';
import { StockMovementsPage } from './pages/Stock/StockMovementsPage';
import { StockAlertsPage } from './pages/Stock/StockAlertsPage';
import { MelgueiraDetail } from './pages/Stock/MelgueiraDetail';
import { PartnersPage } from './pages/Partners/PartnersPage';
import { PartnerDetail } from './pages/Partners/PartnerDetail';
import { PartnerQualityPage } from './pages/Partners/PartnerQualityPage';
import { PartnerFinancePage } from './pages/Partners/PartnerFinancePage';
import { InstructionsPage } from './pages/Instructions/InstructionsPage';
import { DivisionsPage } from './pages/Divisions/DivisionsPage';
import { DivisionDetail } from './pages/Divisions/DivisionDetail';
import { SocioDashboard } from './pages/Dashboard/SocioDashboard';
import { ResponsavelDashboard } from './pages/Dashboard/ResponsavelDashboard';
import { TratadorDashboard } from './pages/Dashboard/TratadorDashboard';
import { FinanceiroDashboard } from './pages/Financeiro/FinanceiroDashboard';
import { ProducaoPage } from './pages/Financeiro/ProducaoPage';
import { CustosPage } from './pages/Financeiro/CustosPage';
import { AuditPage } from './pages/Admin/AuditPage';
import { SystemHealthPage } from './pages/Admin/SystemHealthPage';
import { SLAReportPage } from './pages/Admin/SLAReportPage';
import { LotesPage } from './pages/Lotes/LotesPage';
import { LoteDetailPage } from './pages/Lotes/LoteDetailPage';
import { RastreabilidadePage } from './pages/Lotes/RastreabilidadePage';
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
      <Route path="rastreabilidade/:local_id" element={<RastreabilidadePage />} />

      <Route element={<ProtectedRoute />}>
        {/* Full-screen pages (no AppShell chrome) */}
        <Route path="inspections/new" element={<ColonyInspectionPage />} />
        <Route path="harvests/new" element={<HarvestWizard />} />
        <Route path="scan" element={<QRScanPage />} />
        <Route path="print/labels" element={<PrintLabelsFullPage />} />

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
          <Route path="batches" element={<BatchesPage />} />
          <Route path="batches/new" element={<BatchNewPage />} />
          <Route path="batches/quality" element={<BatchQualityPage />} />
          <Route path="batches/reports" element={<BatchReportsPage />} />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="stock/movements" element={<StockMovementsPage />} />
          <Route path="stock/alerts" element={<StockAlertsPage />} />
          <Route path="stock/melgueiras/:id" element={<MelgueiraDetail />} />
          <Route path="stock/:apiaryId" element={<StockApiaryPage />} />
          <Route path="partners" element={<PartnersPage />} />
          <Route path="partners/quality" element={<PartnerQualityPage />} />
          <Route path="partners/finance" element={<PartnerFinancePage />} />
          <Route path="partners/:id" element={<PartnerDetail />} />
          <Route path="instructions" element={<InstructionsPage />} />
          <Route path="divisions" element={<DivisionsPage />} />
          <Route path="divisions/:id" element={<DivisionDetail />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="financeiro" element={<FinanceiroDashboard />} />
          <Route path="financeiro/producao" element={<ProducaoPage />} />
          <Route path="financeiro/custos" element={<CustosPage />} />
          <Route path="lotes" element={<LotesPage />} />
          <Route path="lotes/:id" element={<LoteDetailPage />} />
          <Route path="admin/audit" element={<AuditPage />} />
          <Route path="admin/health" element={<SystemHealthPage />} />
          <Route path="admin/sla-report" element={<SLAReportPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
