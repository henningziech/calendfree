// backend/src/services/templates.ts
import Handlebars from 'handlebars';

/** Available template variables for all booking-related emails. */
export interface TemplateVars {
  customerName: string;
  customerEmail: string;
  consultantName: string;
  consultantEmail: string;
  eventTypeTitle: string;
  dateTime: string;
  duration: number;
  meetLink: string | null;
  cancelUrl: string;
  rescheduleUrl: string;
  companyName: string;
  reminderText?: string;
}

const DEFAULT_TEMPLATES_DE = {
  'booking-confirmation': {
    subject: 'Terminbestätigung: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Termin bestätigt</h2>
        <p>Hallo {{customerName}},</p>
        <p>Ihr Termin <strong>{{eventTypeTitle}}</strong> mit {{consultantName}} wurde bestätigt.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Wann:</td><td>{{dateTime}}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Dauer:</td><td>{{duration}} Minuten</td></tr>
          {{#if meetLink}}
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Meeting-Link:</td><td><a href="{{meetLink}}">Google Meet beitreten</a></td></tr>
          {{/if}}
        </table>
        <p>
          <a href="{{rescheduleUrl}}" style="color: #2563EB;">Termin verschieben</a> &nbsp;|&nbsp;
          <a href="{{cancelUrl}}" style="color: #DC2626;">Termin absagen</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">{{companyName}} — Powered by Calendfree</p>
      </div>
    `,
  },
  'booking-reminder': {
    subject: 'Erinnerung: {{eventTypeTitle}} in {{reminderText}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Terminerinnerung</h2>
        <p>Hallo {{customerName}},</p>
        <p>Ihr Termin <strong>{{eventTypeTitle}}</strong> mit {{consultantName}} beginnt in {{reminderText}}.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Wann:</td><td>{{dateTime}}</td></tr>
          {{#if meetLink}}
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Meeting-Link:</td><td><a href="{{meetLink}}">Google Meet beitreten</a></td></tr>
          {{/if}}
        </table>
        <p>
          <a href="{{rescheduleUrl}}" style="color: #2563EB;">Termin verschieben</a> &nbsp;|&nbsp;
          <a href="{{cancelUrl}}" style="color: #DC2626;">Termin absagen</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">{{companyName}} — Powered by Calendfree</p>
      </div>
    `,
  },
  'booking-cancellation': {
    subject: 'Termin abgesagt: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Termin abgesagt</h2>
        <p>Hallo {{customerName}},</p>
        <p>Ihr Termin <strong>{{eventTypeTitle}}</strong> mit {{consultantName}} am {{dateTime}} wurde abgesagt.</p>
        <p>Sie können gerne einen neuen Termin buchen.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">{{companyName}} — Powered by Calendfree</p>
      </div>
    `,
  },
  'booking-followup': {
    subject: 'Vielen Dank für Ihren Termin: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Vielen Dank!</h2>
        <p>Hallo {{customerName}},</p>
        <p>Vielen Dank, dass Sie sich die Zeit für <strong>{{eventTypeTitle}}</strong> mit {{consultantName}} genommen haben.</p>
        <p>Wir freuen uns auf die weitere Zusammenarbeit!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">{{companyName}} — Powered by Calendfree</p>
      </div>
    `,
  },
} as const;

const DEFAULT_TEMPLATES_EN = {
  'booking-confirmation': {
    subject: 'Booking Confirmation: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Appointment Confirmed</h2>
        <p>Hello {{customerName}},</p>
        <p>Your appointment <strong>{{eventTypeTitle}}</strong> with {{consultantName}} has been confirmed.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">When:</td><td>{{dateTime}}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Duration:</td><td>{{duration}} minutes</td></tr>
          {{#if meetLink}}
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Meeting Link:</td><td><a href="{{meetLink}}">Join Google Meet</a></td></tr>
          {{/if}}
        </table>
        <p>
          <a href="{{rescheduleUrl}}" style="color: #2563EB;">Reschedule</a> &nbsp;|&nbsp;
          <a href="{{cancelUrl}}" style="color: #DC2626;">Cancel</a>
        </p>
      </div>
    `,
  },
  'booking-reminder': {
    subject: 'Reminder: {{eventTypeTitle}} in {{reminderText}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Appointment Reminder</h2>
        <p>Hello {{customerName}},</p>
        <p>Your appointment <strong>{{eventTypeTitle}}</strong> with {{consultantName}} starts in {{reminderText}}.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">When:</td><td>{{dateTime}}</td></tr>
          {{#if meetLink}}
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Meeting Link:</td><td><a href="{{meetLink}}">Join Google Meet</a></td></tr>
          {{/if}}
        </table>
        <p>
          <a href="{{rescheduleUrl}}" style="color: #2563EB;">Reschedule</a> &nbsp;|&nbsp;
          <a href="{{cancelUrl}}" style="color: #DC2626;">Cancel</a>
        </p>
      </div>
    `,
  },
  'booking-cancellation': {
    subject: 'Appointment Cancelled: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Appointment Cancelled</h2>
        <p>Hello {{customerName}},</p>
        <p>Your appointment <strong>{{eventTypeTitle}}</strong> with {{consultantName}} on {{dateTime}} has been cancelled.</p>
        <p>You are welcome to book a new appointment.</p>
      </div>
    `,
  },
  'booking-followup': {
    subject: 'Thank you for your appointment: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank You!</h2>
        <p>Hello {{customerName}},</p>
        <p>Thank you for taking the time for <strong>{{eventTypeTitle}}</strong> with {{consultantName}}.</p>
        <p>We look forward to working with you!</p>
      </div>
    `,
  },
} as const;

export type TemplateName = keyof typeof DEFAULT_TEMPLATES_DE;

/**
 * Return the default templates for the given language code.
 * Falls back to German if the language is not 'en'.
 */
function getDefaultTemplates(language: string) {
  return language === 'en' ? DEFAULT_TEMPLATES_EN : DEFAULT_TEMPLATES_DE;
}

/**
 * Wrap HTML email content with branding (logo, primary color border, footer).
 */
export function wrapWithBranding(
  htmlContent: string,
  branding?: { logoUrl?: string | null; primaryColor?: string | null; companyName?: string },
): string {
  const primaryColor = branding?.primaryColor ?? '#0B8ECA';
  const logoHtml = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.companyName ?? ''}" style="max-height: 40px; margin-bottom: 16px;">`
    : '';
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      ${logoHtml}
      <div style="border-top: 3px solid ${primaryColor}; padding-top: 16px;">
        ${htmlContent}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">${branding?.companyName ?? 'Calendfree'} — Powered by Calendfree</p>
    </div>
  `;
}

/**
 * Render a notification email with support for custom template overrides,
 * language selection, and branding.
 */
export function renderNotificationEmail(params: {
  type: TemplateName;
  customSubject?: string | null;
  customBody?: string | null;
  vars: TemplateVars & Record<string, unknown>;
  branding?: { logoUrl?: string | null; primaryColor?: string | null; companyName?: string };
  language?: string;
}): { subject: string; htmlBody: string } {
  const { type, customSubject, customBody, vars, branding, language } = params;
  const defaults = getDefaultTemplates(language ?? 'de')[type];

  const subjectSrc = customSubject ?? defaults.subject;
  const bodySrc = customBody ?? defaults.body;

  const subject = Handlebars.compile(subjectSrc)(vars);

  let htmlBody: string;
  if (customBody) {
    // Custom body is plaintext with Handlebars vars — convert newlines to <br>
    const renderedText = Handlebars.compile(bodySrc)(vars);
    htmlBody = `<p>${renderedText.replace(/\n/g, '<br>')}</p>`;
  } else {
    // Default templates already contain HTML
    htmlBody = Handlebars.compile(bodySrc)(vars);
  }

  return { subject, htmlBody: wrapWithBranding(htmlBody, branding) };
}

/**
 * Render an email template with the given variables.
 * Returns { subject, htmlBody } ready for EmailService.
 */
export function renderTemplate(
  templateName: TemplateName,
  vars: TemplateVars & Record<string, unknown>,
): { subject: string; htmlBody: string } {
  const template = DEFAULT_TEMPLATES_DE[templateName];

  const subjectTemplate = Handlebars.compile(template.subject);
  const bodyTemplate = Handlebars.compile(template.body);

  return {
    subject: subjectTemplate(vars),
    htmlBody: bodyTemplate(vars),
  };
}
