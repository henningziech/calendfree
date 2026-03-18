import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';
import apiSidebar from './docs/api/sidebar';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/setup',
        'getting-started/first-booking',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/event-types',
        'features/booking-flow',
        'features/teams-round-robin',
        'features/availability',
        'features/routing-forms',
        'features/branding',
        'features/embed-widget',
        'features/google-calendar',
        'features/analytics',
        'features/api-keys',
        'features/notifications',
      ],
    },
  ],
  api: [
    {
      type: 'category',
      label: 'API Reference',
      link: { type: 'generated-index', title: 'Calendfree API', description: 'Complete API reference.' },
      items: apiSidebar as any[],
    },
  ],
};

export default sidebars;
