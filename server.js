const express = require("express");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

const clients = {
  broadcaster: null,
  viewer: null,
};

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
        clients.viewer = ws;
        console.log("Viewer registered");
      } else if (data.type === "signal") {
        const target =
          data.target === "broadcaster"
            ? clients.broadcaster
            : data.target === "viewer"
            ? clients.viewer
            : null;

        if (target && target.readyState === WebSocket.OPEN) {
          target.send(
            JSON.stringify({
              type: "signal",
              data: data.data,
            })
          );
        } else {
          console.warn("Target not available or not open");
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
    } else if (ws === clients.viewer) {
      console.log("Viewer disconnected");
      clients.viewer = null;
    }
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

app.get("/broadcast", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "broadcast.html"));
});

app.get("/watch", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "watch.html"));
});
