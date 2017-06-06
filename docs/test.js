var peer = new Peer({ key: 'ce16d9aa-4119-4097-a8a5-3a5016c6a81c', debug: 3 });
var msPC = null;
var devices = null;
var deviceIdx = 0;
var socket = null;

btnStart.onclick = evt => {
  peer.on('open', id => {
    socket = peer.socket;
    console.log('peer on "open"');
    myIdDisp.textContent = id;
    navigator.mediaDevices.enumerateDevices().then(devs => {
      if (devs.length > 0) {
        devices = devs;
        multiStreamPCSetup(peer.socket);
        btnAddStream.style.display = '';
        btnAddStream.onclick = evt => {
          addStream();
          if(deviceIdx === devices.length - 1) {
            btnAddStream.style.display = 'none';
          }
        }
      }
    });
  });
};

function multiStreamPCSetup(socket) {
  msPC = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.skyway.io:3478' }] });
  msPC.onicecandidate = evt => {
    console.log('msPC onicecandidate', evt.candidate);
    socket.send(JSON.stringify({
      type: 'CANDIDATE',
      cnd: evt.candidate,
      dst: callTo.value
    }));
  };
  msPC.onnegotiationneeded = evt => {
    console.log('msPC onnegotiationneeded');
    msPC.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(_ => socket.send(JSON.stringify({
        type: 'OFFER',
        ofr: pc.localDescription,
        dst: callTo.value
      })))
      .catch(e => console.log('create offer error', e));
  }
  msPC.onaddstream = evt => {
    console.log('msPC onaddstream');
    createVideoElm(remoteStreamContainer, evt.stream);
  };
  socket.on('message', function (data) {
    console.log('socket on "message"', data);
    const msg = JSON.parse(data);
    if(msg.ans) {
      pc.setRemoteDescription(new RTCSessionDescription(msg.ans));
    }
    if(msg.ofr) { 
      pc.setRemoteDescription(new RTCSessionDescription(msg.ofr))
        .then(_ => {
          return pc.createAnswer();
        })
        .then(answer => {
          return pc.setLocalDescription(answer);
        })
        .then(_ => {
          return socket.send(JSON.stringify({ 
            type: 'ANSWER', 
            ans: pc.localDescription, 
            dst: msg.src 
          }))
        })
        .catch(e => console.log('set remote offer error', e));
    }
    if(msg.cnd) {
       pc.addIceCandidate(new RTCIceCandidate(msg.cnd));
    }
    //if(msg.type === 'PING') socket.send(JSON.stringify({ type: 'PONG' }));
  });
};

function addStream() {
  navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: devices[deviceIdx].deviceId
    }
  }).then(stream => {
    selfView.srcObject = stream;
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