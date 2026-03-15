// backend/src/services/templates.ts
import Handlebars from 'handlebars';

/** Available template variables for all booking-related emails. */
export interface TemplateVars {
  customerName: string;
  consultantName: string;
  consultantEmail: string;
  eventTypeTitle: string;
  dateTime: string;
  duration: number;
  meetLink: string | null;
  cancelUrl: string;
  rescheduleUrl: string;
  companyName: string;
}

const DEFAULT_TEMPLATES = {
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

export type TemplateName = keyof typeof DEFAULT_TEMPLATES;

/**
 * Render an email template with the given variables.
 * Returns { subject, htmlBody } ready for EmailService.
 */
export function renderTemplate(
  templateName: TemplateName,
  vars: TemplateVars & Record<string, unknown>,
): { subject: string; htmlBody: string } {
  const template = DEFAULT_TEMPLATES[templateName];

  const subjectTemplate = Handlebars.compile(template.subject);
  const bodyTemplate = Handlebars.compile(template.body);

  return {
    subject: subjectTemplate(vars),
    htmlBody: bodyTemplate(vars),
  };
}
