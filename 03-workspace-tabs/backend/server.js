const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Y = require("yjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});

// Structural memory store for our workspace states
const projectWorkspaces = {};

io.on("connection", (socket) => {
  console.log(`💻 IDE Workspace Connection Established: ${socket.id}`);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    if (!projectWorkspaces[roomId]) {
      projectWorkspaces[roomId] = {
        doc: new Y.Doc(),
        // Map to track user cursor metrics in memory
        awareness: {},
      };
      console.log(
        `🏗️  Multi-File VFS Framework initialized for Workspace [${roomId}]`,
      );
    }

    // Transmit the current server state structure down to the joining peer
    const currentDoc = projectWorkspaces[roomId].doc;
    const serverStateVector = Y.encodeStateVector(currentDoc);
    socket.emit("sync-step-1", serverStateVector);

    // Send down existing awareness states so the new user sees active users instantly
    socket.emit("awareness-update", projectWorkspaces[roomId].awareness);
  });

  // Handle binary CRDT file structural edits
  socket.on("sync-update", ({ roomId, updateBuffer }) => {
    const workspace = projectWorkspaces[roomId];
    if (!workspace) return;

    try {
      Y.applyUpdate(workspace.doc, Buffer.from(updateBuffer));
      socket.to(roomId).emit("sync-update", updateBuffer);
    } catch (err) {
      console.error("Failed to patch structural VFS model:", err);
    }
  });

  // EVENT 2: Handle incoming awareness coordinate shifts (Mouse clicks / Typing selection changes)
  socket.on("awareness-update", ({ roomId, clientData }) => {
    const workspace = projectWorkspaces[roomId];
    if (!workspace) return;

    // Merge the client's current positional metadata state into our memory store
    workspace.awareness[socket.id] = clientData;

    // Broadcast the updated presence state map to everyone else in the workspace room
    socket.to(roomId).emit("awareness-update", workspace.awareness);
  });

  socket.on("disconnect", () => {
    // Find rooms where this specific socket ID had an active tracking footprint
    for (const roomId in projectWorkspaces) {
      if (projectWorkspaces[roomId].awareness[socket.id]) {
        console.log(`❌ Removing presence track for client: ${socket.id}`);
        delete projectWorkspaces[roomId].awareness[socket.id];
        // Alert remaining suite developers to sweep the user cursor off their layouts
        io.to(roomId).emit(
          "awareness-update",
          projectWorkspaces[roomId].awareness,
        );
      }
    }
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Workspace Engine live at http://localhost:${PORT}`);
});
