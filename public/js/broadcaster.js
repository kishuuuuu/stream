class Broadcaster {
  constructor() {
    this.ws = null;
    this.peerConnections = {}; // viewerId -> RTCPeerConnection
    this.localStream = null;

    this.init();
  }

  async init() {
    await this.startStream();
    this.connectWebSocket();
    window.addEventListener("beforeunload", () => this.cleanup());
  }

  async startStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const video = document.getElementById("video");
      video.srcObject = this.localStream;
    } catch (err) {
      console.error("Error accessing media devices.", err);
    }
  }

  connectWebSocket() {
    this.ws = new WebSocket(`ws://${window.location.host}`);

    this.ws.onopen = () => {
      console.log("WebSocket connected, registering broadcaster");
      this.ws.send(JSON.stringify({ type: "broadcaster" }));
    };

    this.ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "new-viewer") {
        const viewerId = message.from;
        console.log("New viewer connected:", viewerId);
        await this.createPeerConnection(viewerId);
      }

      if (message.type === "signal") {
        const { from: viewerId, data } = message;

        if (data.type === "answer") {
          await this.peerConnections[viewerId].setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } else if (data.type === "candidate") {
          await this.peerConnections[viewerId].addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        }
      }
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  async createPeerConnection(viewerId) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    this.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(
          JSON.stringify({
            type: "signal",
            target: viewerId,
            data: {
              type: "candidate",
              candidate: event.candidate,
            },
          })
        );
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.ws.send(
      JSON.stringify({
        type: "signal",
        target: viewerId,
        data: {
          type: "offer",
          offer: pc.localDescription,
        },
      })
    );

    this.peerConnections[viewerId] = pc;
  }

  cleanup() {
    for (let id in this.peerConnections) {
      this.peerConnections[id].close();
    }
    if (this.ws) this.ws.close();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Broadcaster();
});
