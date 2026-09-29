# whendow.ui — Coding Style Reference

Source project: `/workspace/whendow.ui` (package `whendow-ui`, branch `master`).
Purpose of this doc: describe the **coding style, types, and common patterns** that
eco-evo should emulate. This is a style guide, not an architecture mandate — some parts of
whendow.ui are experimental or rough, and those are flagged as "do not copy".

---

## 1. What whendow.ui is

A single-page React app for group scheduling (brand: "woahbundie"). A meeting owner picks a
date range and creates a meeting; a shareable link lets participants mark availability on a
calendar heatmap; the owner locks winning dates. Identity is a username + passcode stored in
a cookie. Backend is a GraphQL API.

It matters to eco-evo only as a **style exemplar**: const arrow functions, `type` aliases,
co-located props types, React Query data layer, co-located tests. **Exception:** eco-evo does
not adopt its styled-components styling — eco-evo uses **CSS Modules** (see §6).

---

## 2. Tech stack

| Area | Choice | Version |
|---|---|---|
| Framework | React + ReactDOM | `^19.2.8` |
| Router | `react-router-dom` | `^7.18.3` |
| Server state | `@tanstack/react-query` | `^5.56.2` |
| Styling | `styled-components` | `^6.1.12` |
| Class utils | `classnames` | `^2.5.1` |
| Build | Vite + `@vitejs/plugin-react-swc` | `^8.2.2` |
| Language | TypeScript | `^6.0.3` |
| Unit tests | Vitest + Testing Library (jsdom) | `^4.1.11` |
| Visual/component tests | Playwright CT | `1.61.0` |
| Lint | ESLint flat config + typescript-eslint | `^10.9.1` |
| Package manager | Yarn 4 (Berry), `nodeLinker: node-modules` | `yarn@4.6.0` |

Notable: **no Prettier / EditorConfig / Biome / Stylelint**. Formatting is manual and
therefore inconsistent (see §5). Declared but unused: `graphql`, `graphql-request`.

### Scripts
```json
"dev": "vite dev --mode dev --port 8000",
"build": "vite build",
"build-safe": "tsc -b && vite build",
"lint": "eslint .",
"test": "vitest run",
"test:visual": "playwright test -c playwright-ct.config.ts"
```

### TypeScript
Root `tsconfig.json` uses project references (`tsconfig.app.json`, `tsconfig.node.json`).
The app config is **strict, no path aliases**:
```json
"target": "ES2020",
"lib": ["ES2020", "DOM", "DOM.Iterable"],
"module": "ESNext",
"moduleResolution": "bundler",
"allowImportingTsExtensions": true,
"isolatedModules": true,
"moduleDetection": "force",
"noEmit": true,
"jsx": "react-jsx",
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true
```
No `baseUrl`/`paths` — **100% relative imports**, no barrel files.

### ESLint (`eslint.config.js`)
Flat config with `js.configs.recommended` + `tseslint.configs.recommended`, `react-hooks`,
`react-refresh`. Key rules:
```js
"react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
```

---

## 3. Directory structure (layer-based, not feature-based)

```
src/
├── App.tsx / main.tsx / Router.tsx / vite-env.d.ts
├── App.css / index.css                Global CSS + @font-face
├── api/
│   ├── gql.ts                         Hand-rolled GraphQL fetch client; exports `request`
│   ├── queries/                       getMeetings, getMeetingById, getAvailabilitiesByMeetingId
│   └── mutations/                     useCreateMeeting, useLockMeeting, useLogin,
│                                      useSetAvailability, useUnlockMeeting
├── Components/                        Flat, PascalCase files; sibling `.styles.ts`
│   ├── Calendar/                      Feature cluster (Calendar, AvailabilityIndicators, ...)
│   ├── Landing/                       LandingTwo
│   └── Elements/                      FloatingInput (legacy/unused)
├── hooks/                             useModal, useUsername
├── utilities/                         cookie, dates, sanitizeUsername (each with .test.ts)
├── test/                              setup.ts, renderWithClient.tsx, calendarDates.ts
└── assets/                            fonts, images
```

- **No barrel files** (no `index.ts`) anywhere.
- Co-location rule: `<Name>.styles.ts` for styles, `<Name>.test.tsx` for Vitest,
  `<Name>.spec.tsx` for Playwright CT.
- Domain types live beside their API call and are imported by UI.

---

## 4. Coding style & conventions

### 4.1 Functions — `const` arrow everywhere
The only `function` declaration is the Vite scaffold `App` in `App.tsx:9`. Everything else:
```tsx
const Meeting = () => { ... };                 // src/Components/Meeting.tsx:19
export const formatDate = (date: string) => {  // src/utilities/dates.ts:1
  ...
};
const AnimatedBackground = () => (             // src/Components/AnimatedBackground.tsx:9
  <Scene aria-hidden="true"> ... </Scene>
);
```
Naming:
- Components/types/styled components: `PascalCase`.
- Functions/variables/hooks: `camelCase`; hooks prefixed `use`.
- Module constants: `SCREAMING_SNAKE_CASE` (`HEARTS_PER_WORD`, `LANE_COUNT`,
  `GET_MEETING_BY_ID_QUERY_KEY`).
- Booleans: `is`/`has`/`can` prefix (`isOpen`, `isOwner`, `hasWinningDates`).
- Handlers: `handleX`; derived getters: `getX`; callback props: `onX`.

### 4.2 Types — `type` only, never `interface`
There are **zero `interface` declarations** in the codebase. No `I` prefix.
```ts
export type Meeting = {
  createdAt: string;
  endDate: string;
  id: string;
  name: string;
  owner: string;
  startDate: string;
  winningDates: string[];
};                                    // src/api/queries/getMeetingById.ts:7

type SetAvailabilityProps = {
  availabilities: MeetingAvailability[];
  endDate: string;
  onCancel?: () => void;
  onSuccess: (availability: string[]) => void;
  startDate: string;
  theme?: IndicatorType;
};                                    // src/Components/SetAvailability.tsx:11
```
Rules:
- Props types are named `<ComponentName>Props`, declared immediately above the component.
- Types are **co-located**, no central `types.ts`.
- **Domain types are exported from the API module** that fetches them and imported by UI
  (`Meeting`, `MeetingAvailability`, `MeetingFromResponse`).
- Enums vs string unions are mixed (`enum CalendarMode`, `type LoginFlowStep`); no policy.
- `import type` used selectively.

### 4.3 React components
- Function components, arrow form, **no `React.FC`**, no explicit return types.
- Props destructured in the parameter list.
- **Default export as a separate statement at the bottom:**
  ```tsx
  const Homepage = () => { ... };
  export default Homepage;
  ```
- Small presentational sub-components declared above the main component, not memoized.
- Named exports reserved for styled components, types, hooks, query keys, utilities.
- File name `PascalCase` matching the default export.

### 4.4 Data layer — the strongest common pattern to copy
`src/api/gql.ts` is a hand-rolled generic fetch wrapper (not `graphql-request`):
```ts
const API_BASE = import.meta.env.VITE_API_BASE;
const createGraphqlClient = (url: string) => {
  const request = async <T>(query: string, variables: { [key: string]: unknown } = {}): Promise<T> => {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { ...variables } }),
    });
    return await res.json();
  };
  return { request };
};
const client = createGraphqlClient(`${API_BASE}/graphql/`);
const { request } = client;
export { request };
```
Every query module follows the same template — `query` string -> domain type -> response
type -> **exported query-key constant** -> default-exported hook:
```ts
export const GET_MEETING_BY_ID_QUERY_KEY = "GET_MEETING_BY_ID";

const useGetMeetingById = (input: GetMeetingByIdInput) =>
  useQuery({
    queryKey: [GET_MEETING_BY_ID_QUERY_KEY, input.id],
    queryFn: async () => request<GetMeetingByIdResponse>(query, { input }),
    select: (data) => ({
      ...data.data.meetingById,
      startDate: formatDate(data.data.meetingById.startDate),
      endDate: formatDate(data.data.meetingById.endDate),
    }),
  });
export default useGetMeetingById;
```
Mutations wrap `useMutation` and invalidate query keys in `onSuccess`; query-key constants are
shared across query and mutation files purely for cache invalidation.

### 4.5 State & hooks
- **Server state: React Query only.** No Redux/Zustand/Context.
- **Local UI state: `useState`**, often an enum mode (`CalendarMode`, `CreateMeetingSteps`).
- Derived booleans via `Boolean(...)`.
- `useModal` returns a component plus controls — a house pattern:
  ```tsx
  const useModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const Modal = ({ children }: ModalProps) => (isOpen ? <Overlay>{children}</Overlay> : null);
    return { Modal, closeModal, openModal, isOpen };
  };
  ```
- Error handling is minimal/ad hoc; no global error boundary or toast. Mutations expose
  `isPending`/`isLoading` to disable buttons.

### 4.6 Styling
- **styled-components v6 exclusively**; no CSS Modules, Tailwind, or Sass.
- One sibling `<Name>.styles.ts` per component, **named exports**, hardcoded hex colors.
- Variants via **transient props** (`$` prefix) so props don't leak to the DOM:
  ```ts
  export const CountBarFill = styled.div<{ $percentage: number }>`
    width: ${({ $percentage }) => $percentage}%;
  `;
  ```
- Uses `keyframes`, the `css` helper, component extension (`styled(CausticLayer)`), inline
  media queries, and class-based state combined with `classnames`.
- Global CSS limited to `index.css` (font stack, `@font-face` for `simplifica`/`copasetic`)
  and `App.css` (`modern-normalize`, page background `#160222`).
- `dvh` units used deliberately for mobile.
- **No design-token system**; raw hex literals dominate (`#aa2bd1`, `#4b015e`, `#eab9ff`,
  `#0d7b7b`, `#551665`, `#e8e2f4`). A `palette.md` exists but is largely unreflected in code.

### 4.7 Imports & formatting
- Relative imports only, no aliases, no barrels.
- Import order **not enforced and inconsistent** (some files put local imports before
  libraries).
- Double quotes dominate; the Vite scaffold `main.tsx`/`App.tsx` use single quotes and
  `main.tsx` has no semicolons.
- Trailing commas inconsistent.

### 4.8 Testing
- Vitest `*.test.ts(x)` co-located; Playwright CT `*.spec.tsx` co-located.
- Shared helpers under `src/test/`: `renderWithClient.tsx` (wraps UI in a QueryClientProvider
  with retries off), `setup.ts` (jest-dom + RTL cleanup), `calendarDates.ts` fixtures.

---

## 5. House-style summary to emulate

**Do:**
- `const` arrow functions everywhere; default-export components at the bottom; named exports
  for styles, types, constants.
- `type` aliases only (no `interface`, no `I` prefix); `<Component>Props` co-located; domain
  types exported from their API module.
- Props destructured inline; no `React.FC`; no explicit return types.
- React Query for server state; `useState` + enums for local UI state; shared query-key
  constants for invalidation.
- The strict `query -> types -> KEY -> hook` API module template.
- Strict TypeScript; co-located `*.test.ts(x)` and `*.spec.tsx`.
- Relative imports, no barrels.

**Don't copy:**
- **styled-components** — eco-evo uses **CSS Modules** instead (see below).
- Unenforced formatting (no Prettier). If eco-evo wants consistency, add Prettier + import
  sorting rather than mimicking the drift.
- Unused deps (`graphql`, `graphql-request`), leftover `console.log`, non-transient styled
  props, dead/experimental code (`Showcase*`, `Elements/FloatingInput.ts`, `Markie`,
  `GetAWord`), and the double-parse bug in `GetAWord.tsx`.

---

## 6. Styling decision for eco-evo: CSS Modules (not styled-components)

whendow.ui styles components with **styled-components v6** (see §4.6). eco-evo will **not**
use styled-components. Per notes.md, eco-evo uses **CSS Modules**.

Why CSS Modules fits eco-evo:
- Zero runtime dependency — styles compile to static CSS; no CSS-in-JS runtime cost, which
  matters for a heavy simulation running at 60 Hz.
- Natively supported by Vite with no config: name files `*.module.css` and
  `import styles from "./Thing.module.css"`.
- Scoped class names, plain CSS (so design tokens via CSS custom properties work naturally).
- Plays well with a canvas-heavy app where most visuals are in WebGL and only the HUD/panels
  need styling.

Suggested eco-evo conventions (mirroring whendow.ui's co-location, minus styled-components):
- One sibling `<Component>.module.css` per component.
- Reference styles as `styles.root`, `styles.title`, etc.
- Conditional classes via `classnames` (same library whendow.ui uses).
- Variants as extra classes (`styles.wide`) or CSS custom properties set inline, rather than
  styled-component transient `$` props.
- Keep design tokens in a global `:root` (or `theme.css`) as CSS variables.

> The rest of whendow.ui's style (const arrows, `type` aliases, co-located `<Component>Props`,
> the API module template, relative imports, co-located tests) transfers directly and is what
> eco-evo should emulate.
