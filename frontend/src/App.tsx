import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { BookingPage } from './pages/booking/BookingPage';
import { ConfirmationPage } from './pages/booking/ConfirmationPage';
import { CancelPage } from './pages/manage/CancelPage';
import { ReschedulePage } from './pages/manage/ReschedulePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CompaniesPage } from './pages/admin/CompaniesPage';
import { CompanyDetailPage } from './pages/admin/CompanyDetailPage';
import { CompanyBrandingPage } from './pages/admin/CompanyBrandingPage';
import { TeamsPage } from './pages/admin/TeamsPage';
import { EventTypesPage } from './pages/admin/EventTypesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { UserDetailPage } from './pages/admin/UserDetailPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
import { RoutingFormsPage } from './pages/dashboard/RoutingFormsPage';
import { UserDashboard } from './pages/dashboard/UserDashboard';
import { AvailabilityPage } from './pages/dashboard/AvailabilityPage';
import { ApiKeysPage } from './pages/dashboard/ApiKeysPage';
import { AccountSettingsPage } from './pages/dashboard/AccountSettingsPage';
import { MyEventTypesPage } from './pages/dashboard/MyEventTypesPage';
import { MyTeamsPage } from './pages/dashboard/MyTeamsPage';
import { TeamDetailPage } from './pages/dashboard/TeamDetailPage';
import { BookingDetailPage } from './pages/dashboard/BookingDetailPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/manage/:token/cancel" element={<CancelPage />} />
          <Route path="/manage/:token/reschedule" element={<ReschedulePage />} />

          {/* Admin (protected) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="companies/:companyId" element={<CompanyDetailPage />} />
            <Route path="companies/:companyId/branding" element={<CompanyBrandingPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="event-types" element={<EventTypesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:userId" element={<UserDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* User dashboard (protected) */}
          <Route path="/dashboard" element={<AdminLayout />}>
            <Route index element={<UserDashboard />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="my-event-types" element={<MyEventTypesPage />} />
            <Route path="teams" element={<MyTeamsPage />} />
            <Route path="teams/:teamId" element={<TeamDetailPage />} />
            <Route path="bookings/:bookingId" element={<BookingDetailPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
            <Route path="settings" element={<AccountSettingsPage />} />
            <Route path="routing-forms" element={<RoutingFormsPage />} />
          </Route>

          {/* Booking (public, must be last due to catch-all slug pattern) */}
          <Route path="/:companySlug/:eventTypeSlug" element={<BookingPage />} />
          <Route path="/:companySlug/:eventTypeSlug/confirmed" element={<ConfirmationPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
