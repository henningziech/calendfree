// backend/src/__tests__/templates.test.ts
import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../services/templates.js';

describe('TemplateService', () => {
  const baseVars = {
    customerName: 'Max Mustermann',
    consultantName: 'Anna Berater',
    consultantEmail: 'anna@seibert.group',
    eventTypeTitle: '30min Erstgespräch',
    dateTime: '15. März 2026, 10:00 Uhr',
    duration: 30,
    meetLink: 'https://meet.google.com/abc-defg-hij',
    cancelUrl: 'https://calendfree.example.com/manage/token123/cancel',
    rescheduleUrl: 'https://calendfree.example.com/manage/token123/reschedule',
    companyName: 'Seibert Solutions GmbH',
  };

  it('renders booking-confirmation template', () => {
    const result = renderTemplate('booking-confirmation', baseVars);
    expect(result.subject).toContain('30min Erstgespräch');
    expect(result.htmlBody).toContain('Max Mustermann');
    expect(result.htmlBody).toContain('Anna Berater');
    expect(result.htmlBody).toContain('meet.google.com');
    expect(result.htmlBody).toContain('cancel');
    expect(result.htmlBody).toContain('reschedule');
  });

  it('renders booking-reminder template', () => {
    const result = renderTemplate('booking-reminder', {
      ...baseVars,
      reminderText: '1 Stunde',
    });
    expect(result.subject).toContain('1 Stunde');
    expect(result.htmlBody).toContain('Terminerinnerung');
  });

  it('renders booking-cancellation template', () => {
    const result = renderTemplate('booking-cancellation', baseVars);
    expect(result.subject).toContain('abgesagt');
    expect(result.htmlBody).toContain('abgesagt');
  });

  it('renders booking-followup template', () => {
    const result = renderTemplate('booking-followup', baseVars);
    expect(result.subject).toContain('Vielen Dank');
  });

  it('handles null meetLink gracefully', () => {
    const result = renderTemplate('booking-confirmation', {
      ...baseVars,
      meetLink: null,
    });
    expect(result.htmlBody).not.toContain('meet.google.com');
    expect(result.htmlBody).not.toContain('Google Meet beitreten');
  });
});
