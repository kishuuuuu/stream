const socket = io.connect(window.location.origin);
let peerConnections = {};
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

if (localVideo) {
  // Broadcaster
  console.log("Broadcaster page loaded");

  const startStream = async () => {
    try {
      // Get screen share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      console.log("Screen sharing started");

      // Try to get mic (optional)
      let micStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Mic access granted");
      } catch (micError) {
        console.warn("Mic access denied, continuing without mic");
      }

      // Combine streams
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...(micStream ? micStream.getAudioTracks() : []),
      ]);

      localVideo.srcObject = combinedStream;

      // Start broadcasting
      socket.emit("broadcaster");

      socket.on("watcher", (id) => {
        const peerConnection = new RTCPeerConnection(config);
        peerConnections[id] = peerConnection;

        combinedStream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, combinedStream));

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("candidate", id, event.candidate);
          }
        };

        peerConnection
          .createOffer()
          .then((sdp) => peerConnection.setLocalDescription(sdp))
          .then(() => {
            socket.emit("offer", id, peerConnection.localDescription);
          });
      });

      socket.on("answer", (id, description) => {
        peerConnections[id].setRemoteDescription(description);
      });

      socket.on("candidate", (id, candidate) => {
        peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
      });

      socket.on("disconnectPeer", (id) => {
        peerConnections[id]?.close();
        delete peerConnections[id];
      });
    } catch (err) {
      console.error("Error getting screen share:", err);
      alert("Screen sharing failed. Are you running on localhost or HTTPS?");
    }
  };

  startStream();
} else if (remoteVideo) {
  // Viewer
  console.log("Viewer page loaded");

  socket.emit("watcher");
  const peerConnection = new RTCPeerConnection(config);

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", socket.id, event.candidate);
    }
  };

  socket.on("offer", (id, description) => {
    peerConnection
      .setRemoteDescription(description)
      .then(() => peerConnection.createAnswer())
      .then((sdp) => {
        peerConnection.setLocalDescription(sdp);
        socket.emit("answer", id, sdp);
      });
  });

  socket.on("candidate", (id, candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on("disconnectPeer", () => {
    peerConnection.close();
  });
}
