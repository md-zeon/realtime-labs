"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// Establish a singleton connection instance to our backend signal tower
const socket = io("http://localhost:4000", { autoConnect: false });

export default function SignalDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("Available");
  const [registry, setRegistry] = useState({});

  useEffect(() => {
    // Connect to the WebSocket server explicitly
    socket.connect();

    // Built-in lifecycle event listeners
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    // SYSTEM LAB CUSTOM EVENT: Listen for whenever anyone updates their availability status
    socket.on("registry-updated", (updatedRegistry) => {
      setRegistry(updatedRegistry);
    });

    // Clean up event infrastructure when this tab or page unmounts to prevent memory leaks
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("registry-updated");
      socket.disconnect();
    };
  }, []);

  const handleJoinSystem = (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    // SIGNAL 1: Tell the server who we are and our starting status profile
    socket.emit("register-user", { username, status: currentStatus });
    setIsRegistered(true);
  };

  const handleStatusChange = (newStatus) => {
    setCurrentStatus(newStatus);
    // SIGNAL 2: Fire an event upward telling the server we changed our status pill
    socket.emit("update-status", newStatus);
  };

  return (
    <main className="min-h-screen bg-[#0B0F19] text-white p-8 font-sans">
      {/* Header Pipeline State */}
      <header className="flex justify-between items-center max-w-5xl mx-auto border-b border-gray-800 pb-6 mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-purple-400">
            01-Realtime-Signals
          </h1>
          <p className="text-gray-400 text-sm">System Presence Signal Hub</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-full border border-gray-800">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
          />
          <span className="text-xs text-gray-300 font-mono">
            {isConnected ? "PIPE_ACTIVE" : "PIPE_DISCONNECTED"}
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Control Panel / Join Form */}
        <section className="bg-gray-950 p-6 rounded-2xl border border-gray-900 h-fit">
          <h2 className="text-lg font-semibold mb-4 text-gray-200">
            Local Controller
          </h2>

          {!isRegistered ? (
            <form onSubmit={handleJoinSystem} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-2">
                  Assign Nickname
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., Engineer_01"
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 font-medium text-sm py-2.5 rounded-xl transition-all shadow-lg shadow-purple-900/20"
              >
                Establish Pipeline Presence
              </button>
            </form>
          ) : (
            <div>
              <p className="text-xs font-mono uppercase text-gray-500 mb-1">
                Active Identity
              </p>
              <p className="text-lg font-medium text-purple-300 mb-6">
                {username}
              </p>

              <label className="block text-xs font-mono uppercase text-gray-400 mb-2">
                Broadcast Status
              </label>
              <div className="flex flex-col gap-2">
                {["Available", "In a Meeting", "Do Not Disturb"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`text-left text-sm px-4 py-2.5 rounded-xl border transition-all ${
                        currentStatus === status
                          ? "bg-purple-950/40 border-purple-500 text-purple-300 font-medium"
                          : "bg-gray-900/50 border-gray-900 text-gray-400 hover:border-gray-800"
                      }`}
                    >
                      {status}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Realtime Fleet Matrix View */}
        <section className="col-span-2 bg-gray-950 p-6 rounded-2xl border border-gray-900">
          <h2 className="text-lg font-semibold mb-4 text-gray-200">
            Global Fleet Matrix ({Object.keys(registry).length})
          </h2>

          {Object.keys(registry).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600 border border-dashed border-gray-900 rounded-xl">
              <p className="text-sm">
                No remote signals detected down the pipe line.
              </p>
              <p className="text-xs mt-1">
                Register a controller profile or open a secondary window.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(registry).map(([socketId, user]) => (
                <div
                  key={socketId}
                  className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-100">
                      {user.username}
                    </p>
                    <p className="text-[10px] font-mono text-gray-500 mt-0.5">
                      {socketId}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full border font-medium ${
                      user.status === "Available"
                        ? "bg-emerald-950/30 text-emerald-400 border-emerald-900"
                        : user.status === "In a Meeting"
                          ? "bg-amber-950/30 text-amber-400 border-amber-900"
                          : "bg-rose-950/30 text-rose-400 border-rose-900"
                    }`}
                  >
                    {user.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
