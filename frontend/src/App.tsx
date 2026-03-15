import { BrowserRouter, Routes, Route } from 'react-router';
import { BookingPage } from './pages/booking/BookingPage';
import { ConfirmationPage } from './pages/booking/ConfirmationPage';
import { CancelPage } from './pages/manage/CancelPage';
import { ReschedulePage } from './pages/manage/ReschedulePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/HomePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:companySlug/:eventTypeSlug" element={<BookingPage />} />
        <Route path="/:companySlug/:eventTypeSlug/confirmed" element={<ConfirmationPage />} />
        <Route path="/manage/:token/cancel" element={<CancelPage />} />
        <Route path="/manage/:token/reschedule" element={<ReschedulePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
