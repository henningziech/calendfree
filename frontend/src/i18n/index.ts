import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enBooking from './locales/en/booking.json';
import enDashboard from './locales/en/dashboard.json';
import enAdmin from './locales/en/admin.json';
import enRouting from './locales/en/routing.json';

import deCommon from './locales/de/common.json';
import deBooking from './locales/de/booking.json';
import deDashboard from './locales/de/dashboard.json';
import deAdmin from './locales/de/admin.json';
import deRouting from './locales/de/routing.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, booking: enBooking, dashboard: enDashboard, admin: enAdmin, routing: enRouting },
    de: { common: deCommon, booking: deBooking, dashboard: deDashboard, admin: deAdmin, routing: deRouting },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
