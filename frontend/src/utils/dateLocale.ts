import { de } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import i18n from '../i18n';

export function getDateLocale() {
  return i18n.language === 'de' ? de : enUS;
}

export function formatDateLocalized(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
