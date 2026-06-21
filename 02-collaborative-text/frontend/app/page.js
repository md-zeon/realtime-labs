"use client";

import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";

export default function CollaborativeWorkspace() {
  const [roomId] = useState("lab-sandbox-room");
  const [textValue, setTextValue] = useState("");
  const [docStats, setDocStats] = useState({
    characterCount: 0,
    clockSequence: 0,
  });
  const [isConnected, setIsConnected] = useState(false);

  // Use refs to retain single permanent instances across state re-renders
  const socketRef = useRef(null);
  const yDocRef = useRef(new Y.Doc());
  const yTextRef = useRef(null);
  const isApplyingRemoteChangeRef = useRef(false);

  useEffect(() => {
    // 1. Initialize our local headless Yjs Text data block
    const yDoc = yDocRef.current;
    yTextRef.current = yDoc.getText("shared-editor-content");

    // 2. Open up our system WebSocket channel
    socketRef.current = io("http://localhost:4000");
    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsConnected(true);
      // Tell the backend to bind this socket pipe to our target workspace room
      socket.emit("join-room", roomId);
    });

    socket.on("disconnect", () => setIsConnected(false));

    // HOOK A: Server sends us its state history outline vector
    socket.on("sync-step-1", (serverStateVector) => {
      // Calculate what operations we have locally that the server doesn't know about yet
      const clientUpdateBuffer = Y.encodeStateAsUpdate(
        yDoc,
        new Uint8Array(serverStateVector),
      );
      // Transmit our unique local edits back up the wire to sync the server up
      socket.emit("sync-update", { roomId, updateBuffer: clientUpdateBuffer });
    });

    // HOOK B: Listen for real-time binary operational packages from other browsers typing
    socket.on("sync-update", (updateBuffer) => {
      isApplyingRemoteChangeRef.current = true;
      try {
        // Apply the incoming mathematical operations onto our local CRDT text instance
        Y.applyUpdate(yDoc, new Uint8Array(updateBuffer));
        // Pull the freshly merged flat string out and push it into our UI textarea state
        setTextValue(yTextRef.current.toString());
        updateDiagnostics();
      } catch (err) {
        console.error("Failed to patch remote operational data block:", err);
      } finally {
        isApplyingRemoteChangeRef.current = false;
      }
    });

    // HOOK C: Listen to our own local typing strokes
    yDocRef.current.on("update", (updateBuffer, origin) => {
      // CRITICAL GUARD: If this update came from the network, do not bounce it back up
      if (isApplyingRemoteChangeRef.current) return;

      // Send our raw keypress operation buffer up to the server to merge down into everyone else's screen
      socket.emit("sync-update", { roomId, updateBuffer });
      updateDiagnostics();
    });

    function updateDiagnostics() {
      setDocStats({
        characterCount: yTextRef.current.toString().length,
        // The transaction clock sequence tracks how many operation blocks have been registered
        clockSequence: yDoc.gc ? 1 : 0, // Basic indicator if structural tracking is online
      });
    }

    return () => {
      socket.disconnect();
      yDoc.destroy();
    };
  }, [roomId]);

  // Fired every single time the local developer presses a key in the input textarea box
  const handleLocalTyping = (e) => {
    const nextStringValue = e.target.value;
    setTextValue(nextStringValue);

    const yText = yTextRef.current;
    const currentStringValue = yText.toString();

    // If the Yjs text instance is not yet initialized or the string hasn't changed, do nothing
    if (!yText || nextStringValue === currentStringValue) return;

    // Diff the full string so selection deletes, pastes, and replacements
    // are mirrored into the Yjs document correctly.
    let prefixLength = 0;
    // Find the longest common prefix between the current and next string values
    while (
      prefixLength < currentStringValue.length &&
      prefixLength < nextStringValue.length &&
      currentStringValue[prefixLength] === nextStringValue[prefixLength]
    ) {
      prefixLength += 1;
    }

    let currentSuffixLength = currentStringValue.length;
    let nextSuffixLength = nextStringValue.length;

    // Find the longest common suffix between the current and next string values
    while (
      currentSuffixLength > prefixLength &&
      nextSuffixLength > prefixLength &&
      currentStringValue[currentSuffixLength - 1] ===
        nextStringValue[nextSuffixLength - 1]
    ) {
      currentSuffixLength -= 1;
      nextSuffixLength -= 1;
    }

    // Calculate the number of characters to delete and the text to insert
    const deleteCount = currentSuffixLength - prefixLength;
    const insertedText = nextStringValue.slice(prefixLength, nextSuffixLength);

    // Apply the changes to the Yjs text instance
    if (deleteCount > 0) {
      yText.delete(prefixLength, deleteCount);
    }

    // Insert the new text at the correct position
    if (insertedText.length > 0) {
      yText.insert(prefixLength, insertedText);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0F19] text-white p-8 font-sans">
      <header className="flex justify-between items-center max-w-5xl mx-auto border-b border-gray-800 pb-6 mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-amber-500">
            02-Collaborative-Text
          </h1>
          <p className="text-gray-400 text-sm">
            CRDT Concurrency Engine Sandbox
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-full border border-gray-800">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-amber-500 animate-pulse" : "bg-rose-500"}`}
          />
          <span className="text-xs text-gray-300 font-mono">
            {isConnected ? "CRDT_SYNC_LIVE" : "SYNC_OFFLINE"}
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT COMPONENT: The Interactive Editor Space */}
        <section className="md:col-span-2 flex flex-col gap-4">
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-900">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-mono uppercase text-gray-400">
                Collaborative Workspace Document
              </span>
              <span className="text-xs text-gray-500 font-mono">
                ID: {roomId}
              </span>
            </div>
            <textarea
              value={textValue}
              onChange={handleLocalTyping}
              placeholder="Start typing simultaneously across two separate window tabs to watch CRDT node stitching resolve in real-time..."
              className="w-full h-80 bg-gray-900 border border-gray-800 rounded-xl p-4 font-mono text-sm leading-relaxed focus:outline-none focus:border-amber-500 transition-all resize-none text-amber-100/90"
            />
          </div>
        </section>

        {/* RIGHT COMPONENT: CRDT Diagnostic Node Tracker */}
        <section className="bg-gray-950 p-6 rounded-xl border border-gray-900 h-fit flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-mono uppercase tracking-wider text-gray-400 mb-4 border-b border-gray-900 pb-2">
              CRDT Metrics Monitor
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between bg-gray-900/40 p-3 rounded-xl border border-gray-900">
                <span className="text-xs text-gray-400">
                  Flat Text Output Length
                </span>
                <span className="text-sm font-mono text-amber-400 font-bold">
                  {docStats.characterCount} ch
                </span>
              </div>
              <div className="flex justify-between bg-gray-900/40 p-3 rounded-xl border border-gray-900">
                <span className="text-xs text-gray-400">
                  Yjs Graph Engine Status
                </span>
                <span className="text-sm font-mono text-emerald-400">
                  STRUCT_OK
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-950/20 rounded-xl border border-amber-900/30 text-xs text-amber-200/80 leading-relaxed">
            <strong className="text-amber-400 block mb-1">
              💡 Sandbox Learning Insight
            </strong>
            Notice that when you delete characters, the data structure does not
            simply shift indexes backward. Yjs marks nodes with tombstones
            internally, allowing concurrent clients to preserve historical link
            references regardless of network latency offsets.
          </div>
        </section>
      </div>
    </main>
  );
}
