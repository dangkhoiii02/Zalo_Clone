import { Room, RoomEvent, VideoPresets } from 'livekit-client';
import { icons } from '../icons.js';
import { api } from '../api.js';
import { showToast } from '../main.js';

let currentRoom = null;

export async function startCallFlow(calleeId) {
  try {
    // 1. Call API to backend to create room and get token
    const res = await api.startCall(calleeId);
    if (!res.room_name || !res.token) {
        throw new Error('Không nhận được LiveKit token từ server.');
    }
    
    // LiveKit server URL
    const url = 'ws://localhost:7880';
    
    await openVideoCallModal(url, res.token, res.room_name);

  } catch(err) {
    showToast('Lỗi khi gọi video: ' + err.message, 'error');
  }
}

// Function to also handle joining an existing room
export async function joinCallFlow(roomName) {
  try {
    const res = await api.joinCall(roomName);
     if (!res.token) {
        throw new Error('Không nhận được LiveKit token từ server.');
    }
    const url = 'ws://localhost:7880';
    await openVideoCallModal(url, res.token, roomName);
  } catch(err) {
     showToast('Lỗi khi tham gia gọi video: ' + err.message, 'error');
  }
}

async function openVideoCallModal(url, token, roomName) {
  let modalContainer = document.getElementById('modal-root');
  if(!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'modal-root';
    document.body.appendChild(modalContainer);
  }

  modalContainer.innerHTML = `
    <div class="video-call-overlay active" id="video-call-modal">
        <!-- Header -->
        <div style="position:absolute; top:24px; left:24px; z-index:10;">
           <div style="color: white; font-weight: bold; font-size:18px;">Phòng: ${roomName}</div>
           <div id="video-call-status" style="color: #4ade80; font-size: 14px;">Đang kết nối...</div>
        </div>

        <!-- Video Grid -->
        <div class="video-grid" id="video-grid" style="width:100%; height:100%; padding-bottom: 100px;">
           <!-- Local & Remote videos will be appended here -->
        </div>

        <!-- Controls -->
        <div class="video-controls" style="position:absolute; bottom: 32px; left:50%; transform: translateX(-50%); border-radius:32px;">
           <button class="video-control-btn active" id="btn-toggle-mic" title="Bật/Tắt Mic">
             ${icons.mic}
           </button>
           <button class="video-control-btn active" id="btn-toggle-cam" title="Bật/Tắt Camera">
             ${icons.video}
           </button>
           <button class="video-control-btn hangup" id="btn-end-call" title="Kết thúc">
             ${icons.x}
           </button>
        </div>
    </div>
  `;

  const btnMic = document.getElementById('btn-toggle-mic');
  const btnCam = document.getElementById('btn-toggle-cam');
  const btnEnd = document.getElementById('btn-end-call');
  const statusEl = document.getElementById('video-call-status');

  // Initialize Room
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
    },
  });
  currentRoom = room;

  room.on(RoomEvent.Connected, () => {
      statusEl.textContent = 'Đã kết nối';
      statusEl.style.color = '#4ade80';
  });

  room.on(RoomEvent.Disconnected, (reason) => {
     console.log('Room disconnected:', reason);
     closeVideoModal();
  });

  room.on(RoomEvent.MediaDevicesError, (error) => {
    console.error('Media device error:', error);
    showToast('Lỗi thiết bị: ' + error.message, 'error');
  });

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind === 'video') {
        // Video track — create visible container
        const element = track.attach();
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.objectFit = 'cover';
        element.style.borderRadius = 'var(--radius-md)';
        element.dataset.sid = track.sid;

        const wrapper = document.createElement('div');
        wrapper.className = 'video-container';
        wrapper.id = 'video-wrap-' + track.sid;
        wrapper.appendChild(element);

        // Add label
        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = participant.identity;
        wrapper.appendChild(label);

        document.getElementById('video-grid').appendChild(wrapper);
    } else if (track.kind === 'audio') {
        // Audio track — attach to hidden element for playback only
        const element = track.attach();
        element.style.display = 'none';
        element.id = 'audio-' + track.sid;
        document.body.appendChild(element);
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    track.detach();
    // Remove video container or hidden audio element
    const wrapper = document.getElementById('video-wrap-' + track.sid);
    if(wrapper) wrapper.remove();
    const audioEl = document.getElementById('audio-' + track.sid);
    if(audioEl) audioEl.remove();
  });

  room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
      const track = publication.track;
      if (track && (track.kind === 'video' || track.kind === 'audio')) {
         if (track.kind === 'audio') return; // Don't attach local audio, avoids echo
      
         const element = track.attach();
         element.style.width = '100%';
         element.style.height = '100%';
         element.style.objectFit = 'cover';
         element.style.borderRadius = 'var(--radius-md)';
         element.muted = true; // Mute local video element

         const wrapper = document.createElement('div');
         wrapper.className = 'video-container';
         wrapper.id = 'local-video-wrap';
         wrapper.appendChild(element);
         
         const label = document.createElement('div');
         label.className = 'video-label';
         label.textContent = 'Bạn (Local)';
         wrapper.appendChild(label);

         document.getElementById('video-grid').appendChild(wrapper);
      }
  });

  // Connect and publish camera/mic
  try {
     statusEl.textContent = 'Đang kết nối đến phòng...';
     
     await room.connect(url, token);
     
     statusEl.textContent = 'Đang mở camera...';
     
     // Try to publish camera and mic with graceful fallback
     try {
       await room.localParticipant.enableCameraAndMicrophone();
     } catch(mediaErr) {
       console.warn('Could not enable camera/mic:', mediaErr);
       statusEl.textContent = 'Đã kết nối (không có camera)';
       showToast('Không thể mở camera/mic. Kiểm tra quyền truy cập.', 'warning');
     }

     // Control listeners
     let isMicOn = true;
     let isCamOn = true;

     btnMic.addEventListener('click', async () => {
         isMicOn = !isMicOn;
         await room.localParticipant.setMicrophoneEnabled(isMicOn);
         btnMic.classList.toggle('active', isMicOn);
         btnMic.innerHTML = isMicOn ? icons.mic : (icons.micOff || icons.mic);
         if(!isMicOn) btnMic.style.backgroundColor = 'var(--danger)';
         else btnMic.style.backgroundColor = 'rgba(255,255,255,0.2)';
     });

     btnCam.addEventListener('click', async () => {
         isCamOn = !isCamOn;
         await room.localParticipant.setCameraEnabled(isCamOn);
         btnCam.classList.toggle('active', isCamOn);
         btnCam.innerHTML = isCamOn ? icons.video : (icons.videoOff || icons.video);
         if(!isCamOn) btnCam.style.backgroundColor = 'var(--danger)';
         else btnCam.style.backgroundColor = 'rgba(255,255,255,0.2)';
     });

     btnEnd.addEventListener('click', () => {
        room.disconnect();
        closeVideoModal();
     });

  } catch(e) {
      console.error('Video call connection error:', e);
      statusEl.textContent = 'Lỗi kết nối: ' + (e.message || 'Không rõ');
      statusEl.style.color = 'var(--danger)';
      showToast('Không thể kết nối vào phòng video: ' + (e.message || ''), 'error');
      
      // Allow closing even on error
      btnEnd.addEventListener('click', () => {
        closeVideoModal();
      });
  }
}

function closeVideoModal() {
   if(currentRoom) {
      try { currentRoom.disconnect(); } catch(e) {}
      currentRoom = null;
   }
   const modalContainer = document.getElementById('modal-root');
   if(modalContainer) modalContainer.innerHTML = '';
}
