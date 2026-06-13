# ConnectX Frontend

A real-time video conferencing frontend built with **Next.js 16**, supporting 1-to-1 and group calls (up to 10 participants) with chat, screen sharing, emoji reactions, and admin controls.

> **Backend repo:** [connectx-backend](../connectx-backend) — Express + Socket.io signaling server

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Features — How Everything Works](#features--how-everything-works)
  - [Authentication](#authentication)
  - [Dashboard](#dashboard)
  - [1-to-1 Call Room](#1-to-1-call-room)
  - [Group Call Room](#group-call-room)
  - [Socket Hook](#usesocket-hook)
- [WebRTC Architecture](#webrtc-architecture)
- [Route Protection](#route-protection)

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 16.1.6 | React framework, routing, server-side middleware |
| React | 19.2.3 | UI library |
| TypeScript | 5 | Type safety across all components |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui + Radix UI | — | Accessible UI component primitives |
| Socket.io-client | 4.8.3 | Real-time WebSocket communication with backend |
| WebRTC (native browser) | — | Peer-to-peer video, audio, and screen sharing |
| @react-oauth/google | — | Google OAuth 2.0 sign-in button |
| Axios | — | HTTP client for REST API calls |
| jwt-decode | — | Read JWT payload on the client |

---

## Project Structure

```
connectx-frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Root — redirects to /dashboard or /login
│   │   ├── layout.tsx                    # Root layout with AuthProvider
│   │   ├── login/
│   │   │   └── page.tsx                  # Login page (email/password + Google)
│   │   ├── register/
│   │   │   └── page.tsx                  # Register page (email/password + Google)
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Home — create or join a room
│   │   ├── call/
│   │   │   └── [roomId]/
│   │   │       └── page.tsx              # 1-to-1 video call room
│   │   └── group-call/
│   │       └── [roomId]/
│   │           └── page.tsx              # Group video call room (up to 10)
│   ├── context/
│   │   └── AuthContext.tsx               # Global auth state — login/logout/register
│   ├── hooks/
│   │   └── useSocket.ts                  # Socket.io connection with heartbeat
│   ├── lib/
│   │   └── api.ts                        # Axios instance (withCredentials: true)
│   └── middleware.ts                     # Next.js edge middleware — route protection
├── .env.local                            # Local env vars (git-ignored)
├── .gitignore
└── package.json
```

---

## Environment Variables

Create a `.env.local` file in this directory:

```env
# Backend API base URL (REST + WebSocket)
NEXT_PUBLIC_API_URL=http://localhost:5001

# Google OAuth Client ID (same one registered in Google Cloud Console)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# TURN server credentials for NAT traversal (required in production)
NEXT_PUBLIC_TURN_USERNAME=openrelayproject
NEXT_PUBLIC_TURN_CREDENTIAL=openrelayproject
```

> For production, replace `NEXT_PUBLIC_API_URL` with your deployed backend URL and use a paid TURN provider (Twilio, Metered) for reliable connections.

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

---

## Features — How Everything Works

### Authentication

**Files:** [src/context/AuthContext.tsx](src/context/AuthContext.tsx), [src/app/login/page.tsx](src/app/login/page.tsx), [src/app/register/page.tsx](src/app/register/page.tsx)

The entire auth flow is cookie-based. The backend sets a `token` httpOnly cookie — JavaScript never touches the raw JWT.

**On app load:**
1. `AuthContext` fires `GET /api/auth/me`. The browser automatically sends the httpOnly cookie.
2. If valid, the `user` object is set in React context and is available app-wide via `useAuth()`.
3. If the cookie is missing or expired, `user` is set to `null`.

**Email/password login:**
1. User fills the form → `login(email, password)` posts to `POST /api/auth/login`.
2. Backend verifies credentials, signs a JWT, and sets it as a `Set-Cookie` header.
3. On success, `user` state is updated and the router pushes to `/dashboard`.

**Google OAuth login:**
1. `@react-oauth/google` renders the Google button. On click it returns a Google `credential` (ID token).
2. `googleAuth(credential)` posts it to `POST /api/auth/google`.
3. Backend verifies the token with Google's servers (not client-side), creates or links the account, and sets the JWT cookie.

**Logout:**
- Calls `POST /api/auth/logout` → backend clears the cookie → local `user` state reset to `null`.

---

### Dashboard

**File:** [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)

Two actions are available:

| Action | How it works |
|--------|-------------|
| **Start Meeting** | Generates a UUID v4 room ID and navigates to `/call/{roomId}`. The creator is the first in the room. |
| **Join with Code** | User pastes a room ID → navigates to `/call/{roomId}` or `/group-call/{roomId}` depending on which route was shared. |

---

### 1-to-1 Call Room

**File:** [src/app/call/[roomId]/page.tsx](src/app/call/%5BroomId%5D/page.tsx)

This component manages the full lifecycle: media access → signaling → live call → cleanup.

#### Phase 1 — Preview Screen

1. On mount, calls `getUserMedia()` with three fallback constraint sets in order:
   - `{ video: { facingMode: 'user' }, audio: true }` 
   - `{ video: true, audio: true }` (for devices that reject `facingMode`)
   - `{ audio: true }` (audio-only fallback if camera denied)
2. Local stream is set on a `<video muted autoPlay>` element. An explicit `.play()` call is made after `srcObject` is set — this is required for iOS Safari and Android in-app browsers that block autoplay.
3. Camera and mic can be toggled and a different device can be selected before joining.
4. Clicking **Join** emits `join-room` to the backend and transitions to the live screen.

#### Phase 2 — Live Call Screen

**Layout:**
- Remote video fills the full screen.
- Local video is a draggable Picture-in-Picture tile (top-right), mirrored with CSS `scaleX(-1)`.
- Controls bar at the bottom auto-hides after **4 seconds** of inactivity and reappears on any mouse movement or touch.

**Controls bar:**

| Button | What it does |
|--------|-------------|
| **Mic** | Toggles `track.enabled` on all audio tracks. Turns red when muted. |
| **Camera** | Toggles `track.enabled` on all video tracks. Shows name initial avatar when off. |
| **Device picker** | Calls `getUserMedia()` with the new device, then calls `RTCRtpSender.replaceTrack()` on the active peer connection — no renegotiation needed. |
| **Screen share** | Calls `getDisplayMedia()`, replaces the video track on the peer connection. Hidden on mobile via user-agent check. |
| **Info / Invite** | Shows a popup with the shareable room URL. One-click copy with visual feedback. Auto-shown on join. |
| **Chat** | Slides a chat panel open. Shows an unread count badge when messages arrive while the panel is closed. |
| **Reactions** | 6 emoji options. Each floats upward and fades over 3 seconds (CSS keyframes). Sent via `send-reaction` socket event and rendered on both sides. |
| **End call** | Stops all media tracks, disconnects socket, navigates to `/dashboard`. |

**Chat panel:**
- Bottom sheet on mobile, right dock on desktop.
- Messages sent via `chat-message` socket event (relayed to the other peer only — not echoed back).
- Typing indicator: emits `chat-typing` while the user types; stops after 2 seconds idle. Remote side shows animated three dots.
- Unread badge increments while panel is closed, resets on open.
- Disabled (grayed out) when the remote peer is not yet connected.

**Status badge (top-left):**
States cycle: `Initializing media` → `Ready to join` → `Connecting` → `Connected`.  
Once connected, switches to a live call duration timer `HH:MM:SS`.

**WebRTC signaling sequence:**
1. Backend emits `ready` to the first user when a second user joins the room.
2. First user creates `RTCPeerConnection`, adds local tracks, creates an SDP **offer**, emits via `offer`.
3. Second user receives the offer via socket, creates `RTCPeerConnection`, sets remote description, creates **answer**, emits via `answer`.
4. Both sides exchange ICE candidates via `ice-candidate`. Candidates that arrive before `setRemoteDescription` completes are queued and applied after.
5. `pc.ontrack` fires when the remote stream arrives → assigned to the remote `<video>` element.

---

### Group Call Room

**File:** [src/app/group-call/[roomId]/page.tsx](src/app/group-call/%5BroomId%5D/page.tsx)

Extends the 1-to-1 logic with a full-mesh multi-peer architecture, a waiting room, and admin controls.

#### Three Screens

| Screen | When shown |
|--------|-----------|
| Preview | Before joining — camera/mic setup, same as 1-to-1 |
| Waiting Room | Non-admin users waiting for the admin to admit them. Shows the admin's name. |
| Live Call | After admission (or immediately for the first user / admin) |

#### Participant Grid

Auto-calculates columns based on participant count and screen width:
- Mobile: 1–2 columns with taller aspect ratios
- Desktop: up to 5 columns, 2 rows

**Each video tile contains:**
- Live video stream (or an initials avatar if camera is off)
- Name bar at the bottom with an admin crown badge for the room admin
- 5-bar audio level indicator (bars animate in a wave pattern when audio is active)
- Raise hand indicator — yellow pill in the top-right, stays visible until toggled off by the user
- Active speaker ring — a glowing coloured border that cycles through participants every 2.8 seconds
- Floating emoji reactions using the same CSS animation as the 1-to-1 room
- Hover-to-kick button visible only to the admin (not on their own tile)
- `YOU` label on the self tile

#### Admin Controls

| Control | How it works |
|---------|-------------|
| **Waiting Room panel** | Lists all pending users by name. Admit → server runs full admission flow. Reject → server removes them and sends `admission-rejected` to the user. |
| **Mute All** | Emits `group-mute-all` to server → server broadcasts `group-muted-by-admin` to all room members → each client disables their own audio tracks locally. |
| **Kick** | Hover any tile → kick icon appears. Click emits `kick-participant` with the target's socket ID → server force-disconnects that socket. |

#### Raise Hand

Any participant clicks Raise Hand → emits `group-raise-hand` (name + boolean) → server broadcasts to all → yellow pill appears on that user's tile for everyone. The user must click again to lower their hand.

#### Full-Mesh Peer Connections

Unlike 1-to-1, every participant in a group call connects **directly** to every other participant:
- On admission, the new user receives a list of all existing participants.
- For each existing participant, the new user creates an `RTCPeerConnection` and sends an offer via `group-offer` with `targetId` (that participant's socket ID).
- The server routes each offer/answer/ICE candidate directly to the target socket (not broadcast).
- Device switching calls `RTCRtpSender.replaceTrack()` on **every** active peer connection simultaneously.

---

### `useSocket` Hook

**File:** [src/hooks/useSocket.ts](src/hooks/useSocket.ts)

Manages a single Socket.io connection per component mount:

- Connects to `NEXT_PUBLIC_API_URL` with WebSocket as primary transport, long-polling as fallback.
- Auto-reconnects with exponential backoff (1s initial, 5s max, unlimited attempts).
- Sends a `ping` every **25 seconds** as a client heartbeat — keeps the connection alive when the browser tab is backgrounded or the OS throttles idle network connections.
- Cleans up the socket and clears the heartbeat interval on component unmount.

---

## WebRTC Architecture

### ICE / STUN / TURN Configuration

```
STUN (hole-punching for most NATs):
  stun:stun.l.google.com:19302
  stun:stun1.l.google.com:19302
  stun:stun2.l.google.com:19302
  stun:stun3.l.google.com:19302

TURN (relay fallback for strict NAT/firewalls):
  turn:openrelay.metered.ca:80
  turn:openrelay.metered.ca:443
  turn:openrelay.metered.ca:443?transport=tcp
  turns:openrelay.metered.ca:443
  credentials: NEXT_PUBLIC_TURN_USERNAME / NEXT_PUBLIC_TURN_CREDENTIAL
```

**Additional RTCPeerConnection settings:**
- `iceCandidatePoolSize: 10` — pre-gathers candidates before the offer is sent, speeding up connection setup.
- `bundlePolicy: "max-bundle"` — audio and video share a single transport channel.
- `rtcpMuxPolicy: "require"` — RTCP multiplexed with RTP on the same port.

### Topology

| Call type | Topology | Connections for N participants |
|-----------|----------|-------------------------------|
| 1-to-1 | Direct P2P | 1 |
| Group call | Full mesh | N × (N-1) / 2 |

The backend acts as a **signaling-only** server — it never touches media. All video and audio flows directly between browsers.

---

## Route Protection

**File:** [src/middleware.ts](src/middleware.ts)

Next.js Edge Middleware runs **before** any page renders:

- If an unauthenticated user hits any protected route (`/dashboard`, `/call/*`, `/group-call/*`) → redirect to `/login`.
- If an authenticated user hits `/login` or `/register` → redirect to `/dashboard`.
- Auth is checked by reading the `token` cookie from the incoming request headers.

This is server-side protection — the page HTML is never sent to unauthenticated users, not just a client-side redirect.
