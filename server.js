const express = require("express");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

const clients = {
  broadcaster: null,
  viewers: new Map(), // Map of WebSocket -> { id }
};

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received message:", data.type);

      if (data.type === "broadcaster") {
        clients.broadcaster = ws;
        console.log("Broadcaster registered");
      } else if (data.type === "viewer") {
        const viewerId =
          Date.now() + "_" + Math.random().toString(36).substr(2, 5);
        ws.viewerId = viewerId;
        clients.viewers.set(ws, { id: viewerId });

        console.log("Viewer registered:", viewerId);

        // Notify broadcaster about new viewer
        send(clients.broadcaster, {
          type: "new-viewer",
          from: viewerId,
        });
      } else if (data.type === "signal") {
        const { from, target, data: signalData } = data;

        if (target === "broadcaster") {
          send(clients.broadcaster, {
            type: "signal",
            from,
            data: signalData,
          });
        } else {
          // Send to correct viewer
          for (let [viewerWs, info] of clients.viewers.entries()) {
            if (info.id === target) {
              send(viewerWs, {
                type: "signal",
                from,
                data: signalData,
              });
              break;
            }
          }
        }
      }
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  ws.on("close", () => {
    if (ws === clients.broadcaster) {
      console.log("Broadcaster disconnected");
      clients.broadcaster = null;
    } else if (clients.viewers.has(ws)) {
      console.log("Viewer disconnected:", ws.viewerId);
      clients.viewers.delete(ws);
    }
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/broadcast", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "broadcast.html"));
});

app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});
