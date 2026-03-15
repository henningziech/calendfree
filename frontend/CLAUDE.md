# Calendfree Frontend

React SPA with Vite, Tailwind CSS, and TypeScript.

## Structure

```
src/
├── App.tsx             # Root component with router
├── main.tsx            # Entry point
├── index.css           # Tailwind imports
├── pages/              # Page components (one per route)
│   ├── booking/        # Public booking pages
│   ├── routing/        # Routing form pages
│   ├── manage/         # Cancel/reschedule pages
│   ├── admin/          # Org-admin panel
│   ├── company/        # Company-admin panel
│   └── dashboard/      # User dashboard
├── components/         # Reusable UI components
│   ├── calendar/       # Slot picker, availability display
│   ├── forms/          # Form components
│   ├── layout/         # Nav, sidebar, branded wrapper
│   └── embed/          # Embed widget component
└── api/                # API client functions
```

## Patterns

### API calls
- All API calls go through functions in `src/api/`
- Use `fetch` with `credentials: 'include'` for session cookies
- Vite proxy forwards `/api` to backend in development

### Styling
- Tailwind CSS utility classes only — no custom CSS files except `index.css`
- Use Tailwind's design tokens for colors, spacing, typography
- Branding colors are loaded from the API and applied via CSS custom properties

### Components
- Prefer functional components with hooks
- Keep components small and focused (< 150 lines)
- Shared state via React Context where needed, local state preferred

### Pages
- Each route maps to a page component in `src/pages/`
- Pages fetch their own data (no global data loading)
- Error and loading states handled per-page
