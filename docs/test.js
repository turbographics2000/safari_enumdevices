var apiKey = 'ce16d9aa-4119-4097-a8a5-3a5016c6a81c';
var msPC = null;
var devices = null;
var deviceIdx = 0;
var socket = null;
var token = Math.random().toString(36).substr(2);

fetch(`https://skyway.io/${apiKey}/id?ts=${Date.now()}${Math.random()}`).then(res => res.text()).then(myId => {
  myIdDisp.textContent = myId;
  socket = new WebSocket(`wss://skyway.io/peerjs?key=${apiKey}&id=${myId}&token=${token}`);
  socket.onmessage = evt => {
    if (!msPC) multiStreamPCSetup();
    const msg = JSON.parse(evt.data);
    if (msg.src && apiKey && !pc) start(dstId = msg.src);
    msg.ans && pc.setRemoteDescription(new RTCSessionDescription(msg.ans));
    msg.ofr && pc.setRemoteDescription(new RTCSessionDescription(msg.ofr))
      .then(_ => pc.createAnswer())
      .then(answer => pc.setLocalDescription(answer))
      .then(_ => socket.send(JSON.stringify({ type: 'ANSWER', ans: pc.localDescription, dst: msg.src })))
      .catch(e => console.log('set remote offer error', e));
    msg.cnd && pc.addIceCandidate(new RTCIceCandidate(msg.cnd));
    msg.type === 'PING' && socket.send(JSON.stringify({ type: 'PONG' }));
  };
  socket.onclose = evt => console.log(`socket close: code=${evt.code}`);

  navigator.mediaDevices.enumerateDevices().then(devs => {
    devices = devs.filter(dev => dev.kind === 'videoinput');
    if (devs.length > 0) {
      if (!msPC) multiStreamPCSetup();
      btnAddStream.style.display = '';
      btnAddStream.onclick = evt => {
        addStream();
        deviceIdx++;
        if (deviceIdx === devices.length) {
          btnAddStream.style.display = 'none';
        }
      }
    }
  });

});

// function socketSetup(socket) {
//   socket.on('message', function (msg) {
//     if (!msPC) multiStreamPCSetup(peer.socket);
//     console.log('socket on "message"', msg);
//     //const msg = JSON.parse(data);
//     if (msg.ans) {
//       console.log('recieve answer', msg.ans);
//       msPC.setRemoteDescription(new RTCSessionDescription(msg.ans));
//     }
//     if (msg.ofr) {
//       console.log('recieve offer', msg.ofr);
//       msPC.setRemoteDescription(new RTCSessionDescription(msg.ofr))
//         .then(_ => {
//           return msPC.createAnswer();
//         })
//         .then(answer => {
//           return msPC.setLocalDescription(answer);
//         })
//         .then(_ => {
//           return socket.send({
//             type: 'ANSWER',
//             ans: msPC.localDescription,
//             dst: msg.src
//           })
//         })
//         .catch(e => console.log('set remote offer error', e));
//     }
//     if (msg.cnd) {
//       msPC.addIceCandidate(new RTCIceCandidate(msg.cnd));
//     }
//     //if(msg.type === 'PING') socket.send(JSON.stringify({ type: 'PONG' }));
//   });
// }

function multiStreamPCSetup() {
  msPC = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.skyway.io:3478' }] });
  msPC.onicecandidate = evt => {
    console.log('msPC onicecandidate', evt.candidate);
    socket.send({
      type: 'CANDIDATE',
      cnd: evt.candidate,
      dst: callTo.value
    });
  };
  msPC.onnegotiationneeded = evt => {
    console.log('msPC onnegotiationneeded');
    msPC.createOffer()
      .then(offer => msPC.setLocalDescription(offer))
      .then(_ => socket.send({
        type: 'OFFER',
        ofr: msPC.localDescription,
        dst: callTo.value
      }))
      .catch(e => console.log('create offer error', e));
  }
  msPC.onaddstream = evt => {
    console.log('msPC onaddstream');
    createVideoElm(remoteStreamContainer, evt.stream);
  };
};

function addStream() {
  navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: devices[deviceIdx].deviceId
    }
  }).then(stream => {
    createVideoElm(selfStreamContainer, stream);
    msPC.addStream(stream);
  }).catch(e => console.log(`${e.name}: ${e.message}`));
  msPC.onaddstream = evt => remoteView.srcObject = evt.stream;
}

function createVideoElm(container, stream) {
  var vid = document.createElement('video');
  vid.muted = true;
  vid.autoplay = true;
  vid.onloadedmetadata = function (evt) {
    console.log('onloadedmetadata');
    this.style.width = (this.videoWidth / this.videoHeight * 160) + 'px';
    this.style.height = '160px';
    container.appendChild(vid);
  }
  vid.srcObject = stream;
  return vid;
}

function webCamSetup(container, video = true, audio = true) {
  return navigator.mediaDevices.getUserMedia({ video, audio }).then(stream => {
    createVideoElm(container, stream);
    return stream;
  }).catch(ex => console.log('getUserMedia error.', ex));
}