class Viewer {
  constructor() {
    this.statusDiv = document.getElementById("status");
    this.videoElement = document.getElementById("video");

    this.ws = null;
    this.peerConnection = null;

    this.init();
  }

  init() {
    this.updateStatus("Connecting...");
    this.connectWebSocket();
    window.addEventListener("beforeunload", () => this.cleanup());
  }

  connectWebSocket() {
    this.ws = new WebSocket(`wss://${window.location.host}`);

    this.ws.onopen = () => {
      console.log("WebSocket connected, sending viewer registration");
      this.ws.send(JSON.stringify({ type: "viewer" }));
      this.updateStatus("");
      this.createPeerConnection();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "signal") {
        const data = message.data;

        if (data.type === "offer") {
          console.log("Received offer:", data.offer);
          this.peerConnection
            .setRemoteDescription(new RTCSessionDescription(data.offer))
            .then(() => {
              return this.peerConnection.createAnswer();
            })
            .then((answer) => {
              return this.peerConnection.setLocalDescription(answer);
            })
            .then(() => {
              this.ws.send(
                JSON.stringify({
                  type: "signal",
                  target: "broadcaster",
                  data: {
                    type: "answer",
                    answer: this.peerConnection.localDescription,
                  },
                })
              );
            })
            .catch(console.error);
        } else if (data.type === "candidate") {
          console.log("Received ICE candidate");
          this.peerConnection
            .addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch(console.error);
        }
      }
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      this.updateStatus("WebSocket error", "error");
    };
  }

  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    this.peerConnection.ontrack = (event) => {
      console.log("Received remote track");
      // Directly assign the remote stream to the video element
      this.videoElement.srcObject = event.streams[0];
      this.updateStatus("", "connected");
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(
          JSON.stringify({
            type: "signal",
            target: "broadcaster",
            data: {
              type: "candidate",
              candidate: event.candidate,
            },
          })
        );
      }
    };
  }

  updateStatus(text, className = "") {
    this.statusDiv.textContent = text;
    this.statusDiv.className = `status ${className}`;
  }

  cleanup() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Viewer();
});
