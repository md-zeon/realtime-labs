# Module 01: Real-Time Signals (System Presence Engine)

This lab module establishes a foundational understanding of **WebSockets** and **Event-Driven Architectures** using Node.js, Express, Socket.io, and Next.js (App Router).

Instead of jumping directly into complex text-editor synchronization, this project isolates the raw network signaling layer. It implements a decoupled client-server architecture tracking system presence and status switches in real-time across concurrent browser sessions.

---

## 📚 Architectural Theory Focus

### 1. HTTP vs. WebSockets

Traditional web operations run on standard **HTTP**, which is a stateless, request-response, half-duplex protocol. In HTTP, data pipelines move sequentially in a single direction, and **the client must always initiate communication**. The server remains blind and deaf to system shifts until a client explicitly sends an HTTP request.

The **WebSocket protocol (RFC 6455)** replaces this model with a persistent, full-duplex TCP tunnel. This allows both the client and server to push raw binary or text data streams down the pipe simultaneously at any microsecond without incurring the overhead of continuous HTTP polling.

### 2. The Lifecycle Handshake

A WebSocket connection begins its life cycle wrapped inside an ordinary HTTP request:

1. **The Upgrade Request:** The browser sends a standard HTTP GET request containing explicit headers (`Upgrade: websocket`, `Connection: Upgrade`).
2. **The Server Acknowledgement:** If the server supports the protocol upgrade, it returns an HTTP `101 Switching Protocols` status code.
3. **The Persistent Tunnel:** The underlying socket connection drops the HTTP protocol wrapper entirely, leaving a direct TCP pipeline open between both nodes until either side triggers a disconnection.

---

## 🫀 Event Anatomy Mapping

Data movement in this module bypasses traditional REST endpoints (`/api/v1/status`) and shifts entirely to custom state hooks.
[ Next.js Client 1 ] ----(register-user)----> [ Express Socket.io Server ]
|
(registry-updated)
|
v
[ All Connected Clients ]

### Upstream Signals (Client -> Server)

- `register-user`: Fired immediately when a user declares their profile identity. Carries a payload containing `username` and starting `status`.
- `update-status`: Fired when a user selects a different availability state pill. Carries a string denoting the target state (`Available`, `In a Meeting`, `Do Not Disturb`).

### Downstream Signals (Server -> Client Fleet)

- `registry-updated`: Dispatched to the global network fleet whenever an identity registers, modifies their state vector, or drops their websocket pipe. Carries the entire reactive `userRegistry` object stored in server memory.

---

## 🛠️ File Layout

```text
01-realtime-signals/
├── backend/
│ ├── server.js # Express wrapper running the Socket.io Server instance
│ └── package.json
├── frontend/
│ ├── app/
│ │ └── page.js # Next.js client-side signal dashboard view
│ └── package.json
└── README.md
```

---

## 🚀 Execution & Verification Sandbox

### 1. Booting the Signals Backbone

Navigate into the backend subsystem, install the decoupled node modules, and fire the runtime process:

```bash
cd backend
npm install
node server.js
```

The server will bind to local port 4000, logging incoming handshakes along with their auto-assigned socket connection IDs (socket.id).

### 2. Launching the Interface Layer

In a secondary terminal tab, spin up the Next.js compilation engine:

```bash
cd ../frontend
npm install
npm run dev
```

The development environment compiles the layout on http://localhost:3000.

### 3. Verification Protocol

Open two separate web browsers (or one standard tab and one incognito window) side-by-side at http://localhost:3000.

- Register a unique nickname in Window 1. Observe the connection indicator switch to PIPE_ACTIVE and watch the global fleet matrix update.
- Register a secondary nickname in Window 2. Observe how the server dynamically updates the registry UI across both screens instantly without triggering standard page reloads.
- Modify an availability status pill in Window 1 and track the reactive view rewrite in Window 2.

## 🧠 Key Takeaways for Future Systems

- **State In-Memory:** The user registry lives inside the server's RAM. If the Express process crashes, all current active states clear. (In upcoming stages, this state will be anchored via Postgres/Prisma).
- **Connection Lifecycle:** The server automatically senses when a socket pipe breaks (disconnect), allowing instantaneous UI cleanup without explicit timeouts.
