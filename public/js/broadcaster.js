class Broadcaster {
  constructor() {
    this.startBtn = document.getElementById("startBtn");
    this.statusDiv = document.getElementById("status");
    this.previewVideo = document.getElementById("preview");

    this.ws = null;
    this.stream = null;
    this.peerConnection = null;

    this.init();
  }

  init() {
    this.startBtn.addEventListener("click", () => this.startBroadcasting());
    window.addEventListener("beforeunload", () => this.cleanup());
  }

  async startBroadcasting() {
    try {
      this.startBtn.disabled = true;
      this.updateStatus("Requesting screen capture...", "waiting");

      // Get screen stream
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      console.log(
        "Got stream with settings:",
        this.stream.getVideoTracks()[0].getSettings()
      );

      this.previewVideo.srcObject = this.stream;
      this.updateStatus("Connecting to server...", "waiting");

      // Connect to signaling server
      this.ws = new WebSocket(`wss://${window.location.host}`);

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ type: "broadcaster" }));
        this.updateStatus("Ready for viewers...", "connected");
        this.setupWebRTC();
      };

      this.ws.onmessage = (event) => {
        console.log("Broadcaster received:", event.data);
        this.handleSignal(event);
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.updateStatus("Connection error", "error");
      };
    } catch (error) {
      console.error("Broadcast error:", error);
      this.updateStatus(`Error: ${error.message}`, "error");
      this.cleanup();
    }
  }

  setupWebRTC() {
    console.log("Setting up WebRTC connection");
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    // Debug WebRTC events
    this.peerConnection.onicecandidate = (event) => {
      console.log("ICE candidate:", event.candidate);
      if (event.candidate) {
        this.ws.send(
          JSON.stringify({
            type: "signal",
            target: "viewer",
            data: {
              type: "candidate",
              candidate: event.candidate,
            },
          })
        );
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        this.peerConnection.iceConnectionState
      );
      if (this.peerConnection.iceConnectionState === "failed") {
        this.peerConnection.restartIce();
      }
    };

    this.peerConnection.onsignalingstatechange = () => {
      console.log("Signaling state:", this.peerConnection.signalingState);
    };

    // Add screen stream to connection
    this.stream.getTracks().forEach((track) => {
      console.log("Adding track:", track.kind);
      this.peerConnection.addTrack(track, this.stream);
    });

    // Create offer
    this.peerConnection
      .createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      })
      .then((offer) => {
        console.log("Created offer:", offer);
        return this.peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        console.log("Sending offer");
        this.ws.send(
          JSON.stringify({
            type: "signal",
            target: "viewer",
            data: {
              type: "offer",
              offer: this.peerConnection.localDescription,
            },
          })
        );
      })
      .catch((err) => console.error("Error creating offer:", err));
  }

  handleSignal(event) {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "signal" && data.data.type === "answer") {
        console.log("Received answer:", data.data.answer);
        this.peerConnection
          .setRemoteDescription(new RTCSessionDescription(data.data.answer))
          .catch((err) =>
            console.error("Error setting remote description:", err)
          );
      }
    } catch (err) {
      console.error("Error handling signal:", err);
    }
  }

  updateStatus(text, className) {
    this.statusDiv.textContent = text;
    this.statusDiv.className = `status ${className}`;
  }

  cleanup() {
    console.log("Cleaning up...");
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.startBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Broadcaster();
});
