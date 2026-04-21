# ConnectX Frontend — Complete File Structure

> **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Socket.IO · WebRTC · shadcn/ui

---

```
connectx-frontend/
│
├── .env                                          ← Environment config (never committed)
│
└── src/
    ├── middleware.ts                             ← Next.js edge middleware (route matching)
    │
    ├── app/                                      ← Next.js App Router root
    │   ├── globals.css                           ← Global CSS (Tailwind v4 + shadcn design tokens)
    │   ├── favicon.ico                           ← Browser tab icon
    │   │
    │   ├── layout.tsx                            ← ROOT LAYOUT — wraps every page in the app
    │   ├── page.tsx                              ← ROOT PAGE — auth-redirect entry point
    │   │
    │   ├── login/
    │   │   └── page.tsx                          ← LOGIN PAGE
    │   │
    │   ├── register/
    │   │   └── page.tsx                          ← REGISTER PAGE
    │   │
    │   ├── dashboard/
    │   │   ├── layout.tsx                        ← DASHBOARD LAYOUT — sidebar + navbar shell
    │   │   ├── page.tsx                          ← DASHBOARD HOME — 1:1 call lobby
    │   │   └── group-calling/
    │   │       └── page.tsx                      ← GROUP CALLING LOBBY
    │   │
    │   ├── call/
    │   │   └── [roomId]/
    │   │       └── page.tsx                      ← 1:1 LIVE CALL ROOM (WebRTC + Socket.IO)
    │   │
    │   └── group-call/
    │       └── [roomId]/
    │           └── page.tsx                      ← GROUP LIVE CALL ROOM (WebRTC mesh + waiting room)
    │
    ├── components/
    │   ├── AppSidebar.tsx                        ← Navigation sidebar
    │   ├── DashboardNavbar.tsx                   ← Top navbar (user info + logout)
    │   ├── ProtectedRoute.tsx                    ← Auth guard wrapper (scaffold — not yet used)
    │   ├── CallControls.tsx                      ← Call control buttons (scaffold — not yet used)
    │   ├── VideoPlayer.tsx                       ← Video element wrapper (scaffold — not yet used)
    │   └── ui/                                   ← shadcn primitive components (do not edit directly)
    │       ├── button.tsx
    │       ├── input.tsx
    │       ├── separator.tsx
    │       ├── sheet.tsx
    │       ├── sidebar.tsx
    │       ├── skeleton.tsx
    │       └── tooltip.tsx
    │
    ├── context/
    │   └── AuthContext.tsx                       ← GLOBAL AUTH STATE (React Context)
    │
    ├── hooks/
    │   ├── useSocket.ts                          ← SOCKET.IO CONNECTION HOOK
    │   └── use-mobile.ts                         ← RESPONSIVE BREAKPOINT HOOK
    │
    └── lib/
        ├── api.ts                                ← AXIOS INSTANCE (shared HTTP client)
        └── utils.ts                              ← cn() — Tailwind class merge utility
```

---

## File Descriptions

---

### `.env`
Stores **client-side environment variables** exposed to the browser via `NEXT_PUBLIC_` prefix.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:5001`) — used by Axios and Socket.IO |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID — passed to `GoogleOAuthProvider` |

> Never committed to git. Must be configured separately in each environment (local, staging, production).

---

### `src/middleware.ts`
Next.js **Edge Middleware** — runs on every request before the page renders (server-side, no browser APIs).

**What it does:**
- Defines route matching via the `config.matcher` export — excludes static files, API routes, images, and favicons from processing.
- Classifies each request path as a public route (`/login`, `/register`), protected route (`/dashboard`, `/call`), or root (`/`).
- Because the backend uses **cross-domain HTTP-only cookies**, the auth cookie is not accessible server-side in a different domain setup. So the middleware currently allows all requests through (`NextResponse.next()`) and **delegates authentication verification to the client-side `AuthContext`**.

> This is where server-side auth guards would live once the cookie domain is same-origin.

---

### `src/app/globals.css`
**Global stylesheet** — loaded once by the root layout and applied to every page.

**What it does:**
- Imports **Tailwind CSS v4** (`@import "tailwindcss"`)
- Imports **tw-animate-css** for Tailwind animation utilities
- Imports **shadcn/ui** design token stylesheet (`shadcn/tailwind.css`)
- Defines a `@theme inline` block that maps CSS custom properties (design tokens) to Tailwind CSS variables — e.g., `--color-background`, `--font-sans`, sidebar colors, chart colors
- Registers a `dark` variant for dark-mode class-based theming

---

### `src/app/layout.tsx`
**Root Layout** — the single HTML document shell that wraps every page in the application.

**What it does:**
- Loads **Geist Sans** and **Geist Mono** from Google Fonts (via `next/font`) and injects them as CSS variables (`--font-geist-sans`, `--font-geist-mono`)
- Sets the global `<Metadata>` (page title: *"ConnectX – Video Calls"*, description)
- Wraps the entire app in `<GoogleOAuthProvider>` — makes the Google OAuth SDK available to any descendant component (used on the login and register pages)
- Wraps the entire app in `<AuthProvider>` — makes authentication state (`user`, `loading`, `login`, `logout`, etc.) available to every page and component via React Context
- Applies Tailwind's `antialiased` class globally

> Every page in the app renders *inside* this layout's `{children}` slot.

---

### `src/app/page.tsx`
**Root Page (`/`)** — pure auth-redirect logic, no meaningful UI.

**What it does:**
- Reads `user` and `loading` from `AuthContext`
- Once `loading` is false:
  - If `user` exists → redirects to `/dashboard`
  - If no `user` → redirects to `/login`
- While loading, shows a pulsing "Redirecting..." text so the screen isn't blank

> Acts as a smart entry point: users landing on `/` are always sent to the right place.

---

### `src/app/login/page.tsx`
**Login Page (`/login`)** — handles email/password and Google OAuth sign-in.

**What it does:**
- Client-side redirect guard: if `AuthContext` already has a `user`, pushes to `/dashboard`
- Renders a login form with email + password fields
- On submit, calls `AuthContext.login(email, password)` which POSTs to `POST /api/auth/login`; on success the backend sets an HTTP-only cookie and the page does `window.location.href = "/dashboard"` (full reload to ensure the cookie is active)
- Renders a Google sign-in button via `@react-oauth/google`'s `<GoogleLogin>` component; on success, calls `AuthContext.googleAuth(credential)` which POSTs the Google ID token to `POST /api/auth/google`
- Displays server-side error messages from `AuthContext.error` in a red alert box
- Links to `/register`

---

### `src/app/register/page.tsx`
**Register Page (`/register`)** — handles new account creation and Google OAuth sign-up.

**What it does:**
- Client-side redirect guard: same as login — pushes to `/dashboard` if already authenticated
- Renders a registration form with name, email, and password fields (min lengths enforced)
- On submit, calls `AuthContext.register(name, email, password)` which POSTs to `POST /api/auth/register`; on success navigates to `/dashboard` via `window.location.href`
- Renders a Google sign-up button (same `@react-oauth/google` flow as login)
- Displays server-side validation errors from `AuthContext.error`
- Links to `/login`

---

### `src/app/dashboard/layout.tsx`
**Dashboard Layout** — the shared shell wrapping all `/dashboard/**` pages.

**What it does:**
- Wraps children in `<SidebarProvider>` (shadcn context that manages sidebar open/closed state)
- Renders `<AppSidebar>` on the left — always visible on desktop, collapsible on mobile
- Renders `<DashboardNavbar>` as a sticky top bar
- Places a scrollable `<main>` below the navbar for page content
- All `/dashboard/...` pages render into the `{children}` slot here

---

### `src/app/dashboard/page.tsx`
**Dashboard Home (`/dashboard`)** — the 1:1 video call lobby.

**What it does:**
- Auth guard: if `user` is null after loading, redirects to `/login`
- **Create Room:** generates a UUID v4 room ID via `uuidv4()` and navigates to `/call/{roomId}`
- **Join Room:** user types a room code into an input and navigates to `/call/{roomId}` (Enter key or arrow button)
- Displays a visual hero section with a mock video grid mockup on large screens

---

### `src/app/dashboard/group-calling/page.tsx`
**Group Calling Lobby (`/dashboard/group-calling`)** — entry point for multi-participant calls.

**What it does:**
- Auth guard: redirects to `/login` if unauthenticated
- **Create tab:**
  - Generates a prefixed room ID: `group_{uuidv4()}` — the `group_` prefix signals to the backend that this is a group room
  - Displays the generated room ID + a copyable full invite URL (`/group-call/{roomId}`)
  - "Start Call Now" navigates to `/group-call/{roomId}`
- **Join tab:**
  - Accepts a room ID or full invite URL; parses the room ID from the URL if pasted
  - Navigates to `/group-call/{roomId}`
- Shows a 4-card feature grid explaining group calling capabilities (static content)

---

### `src/app/call/[roomId]/page.tsx`
**1:1 Live Call Room (`/call/[roomId]`)** — the core peer-to-peer video call implementation.

**What it does:**
- Reads `roomId` from the dynamic URL segment via `useParams`
- Connects to the backend via `useSocket()` hook (Socket.IO)
- **WebRTC signaling flow:**
  1. Captures local media (`getUserMedia` — camera + mic)
  2. Emits `join-room` to the socket server with `{ roomId, userName }`
  3. Receives `user-joined` → creates `RTCPeerConnection`, adds local tracks, creates SDP offer → emits `offer`
  4. Receives `offer` → creates answer → emits `answer`
  5. Exchanges ICE candidates via `ice-candidate` socket events
  6. Sets `remoteVideoRef.srcObject` when the remote track arrives via `pc.ontrack`
- **STUN/TURN servers:** Google STUN + OpenRelay TURN (for NAT traversal)
- **Media controls:** mic mute/unmute, camera on/off, screen share toggle (via `getDisplayMedia`), end call
- **In-call chat:** real-time text messages sent/received over the socket, with typing indicators, message timestamps, and auto-scroll
- **Screen sharing:** replaces the video sender track on the peer connection when screen share is activated; restores camera track when stopped
- **UI states:** idle → connecting → in-call; auto-hides controls on mouse inactivity; shows copy room ID button; displays remote user name overlay

---

### `src/app/group-call/[roomId]/page.tsx`
**Group Live Call Room (`/group-call/[roomId]`)** — full mesh WebRTC for up to 10 participants with an admin waiting room.

**What it does:**

**Three sequential UI screens managed by `roomState`:**

1. **Preview screen** (`roomState === "preview"`)
   - Shows the user's own camera preview before joining
   - Allows toggling mic/camera before entering
   - "Join Now" button sets `hasJoined = true` and `roomState = "in-call"`, triggering the socket effect

2. **Waiting room screen** (`roomState === "waiting"`)
   - Non-admin users land here after emitting `join-group-room` to the socket
   - Socket server responds with `waiting-for-admission` (includes host name)
   - User sees a spinner and the host's name; can still toggle mic/camera; can cancel

3. **In-call screen** (`roomState === "in-call"`)
   - Renders a responsive CSS grid of `VideoTile` components (auto-adjusts columns/rows based on participant count and mobile breakpoint)
   - Local tile always first; remote tiles mapped from `participants` state array
   - Admin sees a **Waiting Panel** sidebar when users are knocking — can Admit or Reject each user individually, or "Admit All"
   - Top bar shows: connection status, participant count (`n / 10`), and a "Host" badge for the admin

**Socket signaling (full mesh — every peer connects to every other peer):**
- `join-group-room` → server assigns admin or non-admin role
- `group-admitted` → non-admin receives list of current peers, sets `roomState = "in-call"`, initiates WebRTC offers to all existing peers
- `group-new-peer` → existing participants receive a new peer's ID and create an offer to them
- `group-offer` / `group-answer` / `group-ice-candidate` → standard WebRTC SDP + ICE exchange per peer pair
- `group-peer-left` → closes the relevant `RTCPeerConnection` and removes the tile
- `group-you-are-admin` → promoted to host when original admin leaves

**Key architecture detail:** The socket `useEffect` depends on `hasJoined` (not `roomState`), so all socket listeners are registered exactly once and survive the preview → waiting → in-call transitions without re-mounting.

---

### `src/components/AppSidebar.tsx`
**Navigation Sidebar** — rendered inside every `/dashboard/**` page via the dashboard layout.

**What it does:**
- Uses shadcn's `<Sidebar>` component system for accessible, collapsible sidebar behavior
- Renders the **ConnectX** brand logo + version in the header
- Renders a two-level nav tree:
  - **Meeting** group: "One on One Link" (`/dashboard`) and "Group Calling" (`/dashboard/group-calling`)
  - **Calling** group: "Voice Call (Coming Soon)" — rendered but disabled (pointer-events-none + opacity)
- Highlights the active route via `usePathname()` comparison against each nav item's `url`
- Renders a `<SidebarRail>` — the collapse toggle handle on the sidebar edge

---

### `src/components/DashboardNavbar.tsx`
**Top Navbar** — rendered at the top of every `/dashboard/**` page via the dashboard layout.

**What it does:**
- Reads `user`, `logout`, and `loading` from `AuthContext`
- Shows a skeleton/pulse animation while auth is loading to avoid layout shift
- Returns `null` if there is no authenticated user (prevents rendering on unauthenticated routes)
- Displays:
  - "Dashboard" heading (hidden on mobile; replaced by the Video icon)
  - Current date (weekday + month + day) — hidden on small screens
  - User's display name and a colored avatar circle (first letter of name, gradient background)
  - A "Sign out" button that calls `AuthContext.logout()`

---

### `src/components/ProtectedRoute.tsx`
**Auth Guard Wrapper** — scaffold component, currently empty (not yet wired up).

> Intended to wrap page components that require authentication and redirect to `/login` if no user is found. Currently the auth guard logic lives inline in each page's `useEffect`.

---

### `src/components/CallControls.tsx`
**Call Control Buttons** — scaffold component, currently empty (not yet wired up).

> Intended to extract the mic/camera/screen-share/end-call button bar from the call pages into a reusable component. Currently the controls are implemented inline in `call/[roomId]/page.tsx` and `group-call/[roomId]/page.tsx`.

---

### `src/components/VideoPlayer.tsx`
**Video Element Wrapper** — scaffold component, currently empty (not yet wired up).

> Intended to wrap the `<video>` element with stream attachment logic (`srcObject`) into a reusable component. Currently video rendering is handled inline in the call pages.

---

### `src/components/ui/` *(shadcn primitives — do not edit directly)*

| File | What it provides |
|---|---|
| `button.tsx` | Styled `<Button>` with variant + size props (primary, outline, ghost, etc.) |
| `input.tsx` | Styled `<Input>` form element |
| `separator.tsx` | Horizontal/vertical `<Separator>` divider |
| `sheet.tsx` | Slide-in drawer/panel (used internally by sidebar on mobile) |
| `sidebar.tsx` | Full sidebar system: `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarRail`, etc. |
| `skeleton.tsx` | Pulsing loading placeholder blocks |
| `tooltip.tsx` | Hover tooltip wrapper |

---

### `src/context/AuthContext.tsx`
**Global Authentication State** — the central source of truth for the logged-in user across the entire app.

**What it provides (via React Context):**

| Export | Type | Description |
|---|---|---|
| `user` | `{ id, name, email } \| null` | The currently authenticated user, or `null` |
| `loading` | `boolean` | `true` while the initial `/api/auth/me` check is in-flight |
| `error` | `string \| null` | Last auth error message (set on failed login/register) |
| `register(name, email, password)` | `Promise<void>` | POSTs to `/api/auth/register`; sets `user` on success |
| `login(email, password)` | `Promise<void>` | POSTs to `/api/auth/login`; sets `user` on success |
| `googleAuth(token)` | `Promise<void>` | POSTs Google ID token to `/api/auth/google`; sets `user` on success |
| `logout()` | `void` | POSTs to `/api/auth/logout`, clears `user`, redirects to `/login` |
| `clearError()` | `void` | Resets `error` to `null` |

**Auth mechanism:** Cookie-based (HTTP-only cookies set by the backend). The Axios instance is created with `withCredentials: true` so cookies are automatically sent with every request. On mount, `AuthProvider` calls `GET /api/auth/me` to hydrate the `user` state from an existing session cookie.

Also exports `useAuth()` — a convenience hook that throws if used outside `<AuthProvider>`.

---

### `src/hooks/useSocket.ts`
**Socket.IO Connection Hook** — manages the WebSocket lifecycle for call pages.

**What it does:**
- Creates a new `socket.io-client` connection to `NEXT_PUBLIC_API_URL` on mount, using the `websocket` transport
- Configures automatic reconnection (up to 5 attempts, 1s delay)
- Returns `null` initially; updates the returned `socket` state to the live socket object only after `connect` fires — so consumers can safely gate logic on `socket !== null`
- Sets `socket` back to `null` on `disconnect`
- Cleans up (calls `socket.disconnect()`) when the component that uses the hook unmounts

> Used directly in `call/[roomId]/page.tsx` and `group-call/[roomId]/page.tsx`.

---

### `src/hooks/use-mobile.ts`
**Responsive Breakpoint Hook** — detects whether the viewport is below the mobile breakpoint.

**What it does:**
- Sets a `MediaQueryList` watcher for `max-width: 767px`
- Returns `true` when the window is ≤767px wide, `false` otherwise
- Cleans up the event listener on unmount
- Used in `group-call/[roomId]/page.tsx` to switch between mobile and desktop video grid layouts

---

### `src/lib/api.ts`
**Shared Axios HTTP Client** — a pre-configured Axios instance used for all backend API calls.

**What it does:**
- Creates an Axios instance with:
  - `baseURL`: `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:5001`)
  - `withCredentials: true` — ensures HTTP-only auth cookies are sent with every request (required for cookie-based authentication)
- No token interceptors needed — the backend manages auth entirely through cookies

> Imported and used directly in `AuthContext.tsx` for all auth-related requests. Other API calls (future features) should import and use this instance.

---

### `src/lib/utils.ts`
**Tailwind Class Merge Utility** — exposes the `cn()` helper function.

**What it does:**
- Combines `clsx` (conditional class joining) with `tailwind-merge` (deduplicates conflicting Tailwind classes)
- `cn("px-2 py-1", condition && "px-4")` → correctly resolves to `"py-1 px-4"` instead of `"px-2 py-1 px-4"`
- Used throughout shadcn components and anywhere conditional Tailwind classes need to be merged cleanly

---

## Data & Auth Flow Summary

```
Browser
  │
  ├─ [Mount] AuthContext.useEffect
  │     └─ GET /api/auth/me  (cookie sent automatically)
  │           ├─ 200 → setUser(data)   → redirect to /dashboard
  │           └─ 401 → setUser(null)   → redirect to /login
  │
  ├─ [Login] AuthContext.login()
  │     └─ POST /api/auth/login        (backend sets HTTP-only cookie)
  │           └─ window.location.href = "/dashboard"
  │
  └─ [Call] call/[roomId]/page.tsx
        ├─ useSocket()  → Socket.IO WS connection
        ├─ getUserMedia → local camera/mic stream
        ├─ socket.emit("join-room", { roomId, userName })
        └─ WebRTC signaling loop (offer → answer → ICE candidates → ontrack)
```
