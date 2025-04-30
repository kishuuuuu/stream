// const express = require("express");
// const WebSocket = require("ws");
// const path = require("path");
// const { v4: uuidv4 } = require("uuid");

// const app = express();
// const PORT = process.env.PORT || 3000;

// const server = app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

// const wss = new WebSocket.Server({ server });

// const streams = {}; // { streamId: { broadcaster: ws, viewers: Set<ws> } }

// wss.on("connection", (ws) => {
//   ws.id = uuidv4(); // assign a unique ID
//   console.log("Client connected:", ws.id);

//   ws.on("message", (message) => {
//     try {
//       const data = JSON.parse(message);
//       const { type, streamId } = data;

//       if (!streamId) return;

//       if (type === "broadcaster") {
//         if (!streams[streamId])
//           streams[streamId] = { broadcaster: null, viewers: new Set() };
//         streams[streamId].broadcaster = ws;
//         ws.streamId = streamId;
//         ws.role = "broadcaster";
//         console.log(`Broadcaster connected to stream ${streamId}`);
//       } else if (type === "viewer") {
//         if (!streams[streamId])
//           streams[streamId] = { broadcaster: null, viewers: new Set() };
//         streams[streamId].viewers.add(ws);
//         ws.streamId = streamId;
//         ws.role = "viewer";
//         console.log(`Viewer ${ws.id} connected to stream ${streamId}`);
//       } else if (type === "signal") {
//         const targetType = data.target;
//         const signalData = data.data;

//         if (targetType === "broadcaster") {
//           const broadcaster = streams[streamId]?.broadcaster;
//           if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
//             broadcaster.send(
//               JSON.stringify({
//                 type: "signal",
//                 streamId,
//                 data: signalData,
//                 from: ws.id,
//               })
//             );
//           }
//         } else if (targetType === "viewer") {
//           const viewerId = data.viewerId;
//           const viewer = [...streams[streamId].viewers].find(
//             (v) => v.id === viewerId
//           );
//           if (viewer && viewer.readyState === WebSocket.OPEN) {
//             viewer.send(
//               JSON.stringify({
//                 type: "signal",
//                 streamId,
//                 data: signalData,
//               })
//             );
//           }
//         }
//       }
//     } catch (err) {
//       console.error("Message error:", err);
//     }
//   });

//   ws.on("close", () => {
//     const { streamId, role } = ws;
//     if (!streamId || !streams[streamId]) return;

//     if (role === "broadcaster") {
//       console.log(`Broadcaster for stream ${streamId} disconnected`);
//       streams[streamId].broadcaster = null;
//     } else if (role === "viewer") {
//       streams[streamId].viewers.delete(ws);
//       console.log(`Viewer ${ws.id} disconnected`);
//     }

//     // Cleanup
//     if (
//       !streams[streamId].broadcaster &&
//       streams[streamId].viewers.size === 0
//     ) {
//       delete streams[streamId];
//     }
//   });
// });

// app.use(express.static(path.join(__dirname, "public")));

// app.get("/broadcast/:id", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "broadcast.html"));
// });

// app.get("/watch/:id", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "watch.html"));
// });
// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let broadcasterSocketId = null;

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("broadcaster", () => {
    broadcasterSocketId = socket.id;
    socket.broadcast.emit("broadcaster");
  });

  socket.on("watcher", () => {
    if (broadcasterSocketId) {
      io.to(broadcasterSocketId).emit("watcher", socket.id);
    }
  });

  socket.on("offer", (id, message) => {
    io.to(id).emit("offer", socket.id, message);
  });

  socket.on("answer", (id, message) => {
    io.to(id).emit("answer", socket.id, message);
  });

  socket.on("candidate", (id, message) => {
    io.to(id).emit("candidate", socket.id, message);
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("disconnectPeer", socket.id);
  });
});

server.listen(3000, () =>
  console.log("Server is running on http://localhost:3000")
);
