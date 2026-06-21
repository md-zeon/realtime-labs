const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Y = require("yjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// A localized memory ecosystem hosting our collaborative text documents.
// In a full application, each room mapped here would house its own separate Y.Doc instance.
const activeDocuments = {};

io.on("connection", (socket) => {
  console.log(`🔌 Collaborative Link Active: Socket ID -> ${socket.id}`);

  // EVENT 1: Triggered when a developer accesses a specific text channel
  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    // If the room doesn't have an active Yjs data structure in memory yet, initialize it
    if (!activeDocuments[roomId]) {
      activeDocuments[roomId] = {
        doc: new Y.Doc(),
        users: {},
      };
      console.log(
        `🏗️  New Headless CRDT Document initialized for Room [${roomId}]`,
      );
    }

    const currentDoc = activeDocuments[roomId].doc;

    // Phase A: Capture the server's current state map vector
    // This calculates exactly what historical character operations this server currently holds.
    const serverStateVector = Y.encodeStateVector(currentDoc);

    // Send a targeted transmission back to ONLY the joining client,
    // handing them the server's state map so they can compute what edits they are missing.
    socket.emit("sync-step-1", serverStateVector);
  });

  // EVENT 2: Receives delta updates containing operational keystroke blocks from clients
  socket.on("sync-update", ({ roomId, updateBuffer }) => {
    const docContext = activeDocuments[roomId];
    if (!docContext) return;

    try {
      // Apply the incoming binary state patch directly onto the server's headless Y.Doc.
      // Yjs merges this seamlessly, instantly resolving any concurrent typing collisions.
      Y.applyUpdate(docContext.doc, Buffer.from(updateBuffer));

      // Broadcast this exact structural update block out to all OTHER screens inside this room.
      socket.to(roomId).emit("sync-update", updateBuffer);
    } catch (err) {
      console.error(`❌ Failed to parse incoming CRDT state patch:`, err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Link Severed: ${socket.id}`);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Concurrency Backend running at http://localhost:${PORT}`);
});
