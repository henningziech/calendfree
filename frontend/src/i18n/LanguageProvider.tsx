import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const isDashboardOrAdmin =
      location.pathname.startsWith('/dashboard') ||
      location.pathname.startsWith('/admin');

    if (isDashboardOrAdmin && user?.language) {
      i18n.changeLanguage(user.language);
    } else if (!isDashboardOrAdmin) {
      i18n.changeLanguage('en');
    }
  }, [location.pathname, user?.language, i18n]);

  return <>{children}</>;
}
