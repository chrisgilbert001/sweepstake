# Coding Conventions

## Language & Modules

- Plain JavaScript (no TypeScript) throughout the project
- ES Modules everywhere (`"type": "module"` in all package.json files)
- Use `import`/`export` syntax, never `require()`
- Document functions with JSDoc comments

## File Naming

| Type | Convention | Example |
|------|-----------|---------|
| React components | PascalCase `.jsx` | `StandingsTable.jsx` |
| Pages | PascalCase `.jsx` | `LeagueDashboard.jsx` |
| CSS | PascalCase matching component | `StandingsTable.css` |
| API modules | camelCase `.js` | `leagues.js` |
| Services | camelCase `.js` | `leagueService.js` |
| Routes | camelCase `.js` | `leagueRoutes.js` |
| Tests | co-located `.test.js` | `leagueRoutes.test.js` |

## React Patterns

- Functional components only (no class components)
- Hooks: `useState`, `useEffect`, `useCallback`, `useContext`, `useRef`
- State management via React Context (`LeagueContext`, `ThemeContext`)
- No external state libraries (no Redux, Zustand, etc.)
- Props documented with JSDoc comment blocks above the component
- Destructure props in function signature

```jsx
/**
 * Card component with elevation variants.
 * @param {'flat' | 'raised' | 'prominent'} [props.elevation='raised']
 * @param {boolean} [props.hoverable=false]
 * @param {React.ReactNode} props.children
 */
export default function Card({ elevation = 'raised', hoverable = false, children }) {
  // ...
}
```

## CSS Patterns

- Co-located CSS files per component (no CSS-in-JS, no Tailwind)
- Use CSS custom properties from `variables.css` for all colors, spacing, typography
- BEM-like class naming: `.component__element--modifier`
- Responsive design with mobile-first approach
- Breakpoints: 480px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Support `prefers-reduced-motion` for animations
- Dark theme via `[data-theme='dark']` selector

## Server Patterns

- Express Router per domain (`leagueRoutes.js`, `teamRoutes.js`, etc.)
- Service layer for business logic (routes are thin controllers)
- Error objects: `{ statusCode: number, message: string }`
- Routes catch service errors and map to HTTP responses
- Storage via `storageService.js` — use `readFile`, `writeFile`, `updateFile`, `atomicWriteFile`
- Admin endpoints protected by `adminAuth` middleware

## API Client (Frontend)

- All API calls go through `api/client.js` which provides `get()`, `post()`, `put()`
- Each domain has its own API module (e.g., `api/leagues.js`, `api/teams.js`)
- Errors thrown as `ApiError` with `status` and `data` properties
- Base URL is `/api` (proxied to server in dev via Vite)

## Testing

- Framework: Vitest
- Server tests: Supertest for HTTP integration tests
- Test files co-located with source (`.test.js` suffix)
- Run with `npm test` (single run) or `npm run test:watch`
