const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors()); // Enable CORS to allow our Next.js server to connect

// Create the standard Node HTTP server wrapping our Express app instance
const server = http.createServer(app);

// Attach Socket.io to the server instance with configured CORS policies
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Standard local port for Next.js
    methods: ["GET", "POST"],
  },
});

// A simple in-memory data store to track user statuses across the system
// In a production app, this would eventually live in Postgres
const userRegistry = {};

// The core event hook: fires every time a new browser completes the WebSocket handshake
io.on("connection", (socket) => {
  console.log(
    `📡 Signal Pipe Established: Connected client assigned ID -> ${socket.id}`,
  );

  // EVENT 1: Listen for a user announcing their presence in the system
  socket.on("register-user", (data) => {
    const { username, status } = data;

    // Save their data mapped to their unique socket connection ID
    userRegistry[socket.id] = { username, status };
    console.log(`👤 User Registered: ${username} is now [${status}]`);

    // Broadcast the updated collective registry to ALL connected clients
    io.emit("registry-updated", userRegistry);
  });

  // EVENT 2: Listen for when a user changes their status pill
  socket.on("update-status", (newStatus) => {
    if (userRegistry[socket.id]) {
      userRegistry[socket.id].status = newStatus;
      console.log(
        `⚡ Status Change: ${userRegistry[socket.id].username} updated to [${newStatus}]`,
      );

      // Broadcast the updated registry to everyone so all dashboards mirror the change
      io.emit("registry-updated", userRegistry);
    }
  });

  // EVENT 3: Native lifecycle hook for handling unexpected or intentional disconnections
  socket.on("disconnect", () => {
    if (userRegistry[socket.id]) {
      console.log(
        `❌ Signal Pipe Broken: ${userRegistry[socket.id].username} disconnected.`,
      );
      // Clean up our memory footprint so dead users don't linger on the UI
      delete userRegistry[socket.id];

      // Inform remaining clients to clear them from their dashboards
      io.emit("registry-updated", userRegistry);
    }
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Signal Server live at http://localhost:${PORT}`);
});
