/**
 * Browser camera/microphone permissions and preview for Researchium Studio.
 */
window.ResearchiumMedia = (function () {
  const PREFS_KEY = 'researchium_media_prefs';

  let stream = null;
  let videoEnabled = true;
  let audioEnabled = true;

  function isSecureContext() {
    return window.isSecureContext === true;
  }

  function hasMediaDevices() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async function queryPermission(name) {
    if (!navigator.permissions?.query) return 'unknown';
    try {
      const status = await navigator.permissions.query({ name });
      return status.state;
    } catch {
      return 'unknown';
    }
  }

  async function getPermissionState() {
    const camera = await queryPermission('camera');
    const microphone = await queryPermission('microphone');
    return { camera, microphone };
  }

  function getErrorMessage(err) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Permission denied. Allow camera and microphone in your browser site settings, then try again.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera or microphone found. Connect a device and try again.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Camera or mic is in use by another app. Close other apps and try again.';
    }
    if (name === 'OverconstrainedError') {
      return 'Selected device is unavailable. Pick another device from the list.';
    }
    if (name === 'SecurityError') {
      return 'Use HTTPS or open this page on localhost to access the camera.';
    }
    return err?.message || 'Could not access camera or microphone.';
  }

  function loadPrefs() {
    try {
      const raw = sessionStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function savePrefs(extra = {}) {
    const videoTrack = stream?.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks()[0];
    const prefs = {
      videoDeviceId: videoTrack?.getSettings?.().deviceId || extra.videoDeviceId,
      audioDeviceId: audioTrack?.getSettings?.().deviceId || extra.audioDeviceId,
      videoEnabled,
      audioEnabled,
      grantedAt: Date.now(),
      ...extra,
    };
    sessionStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    return prefs;
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function buildConstraints(prefs = {}) {
    const p = { ...loadPrefs(), ...prefs };
    let useVideo = p.videoEnabled !== false;
    let useAudio = p.audioEnabled !== false;
    if ('video' in prefs) useVideo = !!prefs.video;
    if ('audio' in prefs) useAudio = !!prefs.audio;
    if ('videoEnabled' in prefs) useVideo = !!prefs.videoEnabled;
    if ('audioEnabled' in prefs) useAudio = !!prefs.audioEnabled;

    const constraints = { video: false, audio: false };
    if (useVideo) {
      constraints.video = p.videoDeviceId
        ? { deviceId: { exact: p.videoDeviceId } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };
    }
    if (useAudio) {
      constraints.audio = p.audioDeviceId
        ? { deviceId: { exact: p.audioDeviceId } }
        : { echoCancellation: true, noiseSuppression: true };
    }
    if (!useVideo && !useAudio) {
      const err = new Error('At least one of camera or microphone must be enabled.');
      err.name = 'InvalidStateError';
      throw err;
    }
    return constraints;
  }

  async function requestAccess(prefs = {}) {
    if (!hasMediaDevices()) {
      const err = new Error('Media devices are not supported in this browser.');
      err.name = 'NotSupportedError';
      throw err;
    }
    if (!isSecureContext()) {
      const err = new Error('Camera access requires HTTPS or localhost.');
      err.name = 'SecurityError';
      throw err;
    }

    stop();
    const constraints = buildConstraints(prefs);
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      if (constraints.video?.deviceId || constraints.audio?.deviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: constraints.video ? true : false,
          audio: constraints.audio ? true : false,
        });
      } else {
        throw e;
      }
    }

    const wantVideo = prefs.videoEnabled !== false && prefs.video !== false;
    const wantAudio = prefs.audioEnabled !== false && prefs.audio !== false;
    videoEnabled = stream.getVideoTracks().length > 0 && wantVideo;
    audioEnabled = stream.getAudioTracks().length > 0 && wantAudio;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = videoEnabled;
    });
    stream.getAudioTracks().forEach((t) => {
      t.enabled = audioEnabled;
    });
    savePrefs(prefs);
    return stream;
  }

  async function ensureAccess({ video = false, audio = false } = {}) {
    const hasVideo = !!stream?.getVideoTracks().length;
    const hasAudio = !!stream?.getAudioTracks().length;
    if (!stream || (video && !hasVideo) || (audio && !hasAudio)) {
      return requestAccess({
        video: video || hasVideo,
        audio: audio || hasAudio,
        videoEnabled: video || (hasVideo && videoEnabled),
        audioEnabled: audio || (hasAudio && audioEnabled),
        videoDeviceId: loadPrefs().videoDeviceId,
        audioDeviceId: loadPrefs().audioDeviceId,
      });
    }
    if (video) setVideoEnabled(true);
    if (audio) setAudioEnabled(true);
    return stream;
  }

  async function enumerateDevices() {
    if (!hasMediaDevices()) return { cameras: [], microphones: [] };
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: devices.filter((d) => d.kind === 'videoinput'),
      microphones: devices.filter((d) => d.kind === 'audioinput'),
      speakers: devices.filter((d) => d.kind === 'audiooutput'),
    };
  }

  async function setAudioOutput(deviceId) {
    if (!deviceId || !document.querySelector('video')?.setSinkId) return;
    const videos = document.querySelectorAll('video');
    for (const el of videos) {
      try {
        await el.setSinkId(deviceId);
      } catch {
        /* unsupported */
      }
    }
  }

  function attachPreview(videoEl) {
    if (!videoEl || !stream) return;
    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    return videoEl.play().catch(() => {});
  }

  function setVideoEnabled(on) {
    videoEnabled = !!on;
    stream?.getVideoTracks().forEach((t) => {
      t.enabled = videoEnabled;
    });
    savePrefs();
    return videoEnabled;
  }

  function setAudioEnabled(on) {
    audioEnabled = !!on;
    stream?.getAudioTracks().forEach((t) => {
      t.enabled = audioEnabled;
    });
    savePrefs();
    return audioEnabled;
  }

  async function switchDevice({ videoDeviceId, audioDeviceId } = {}) {
    const prefs = loadPrefs();
    return requestAccess({
      videoDeviceId: videoDeviceId ?? prefs.videoDeviceId,
      audioDeviceId: audioDeviceId ?? prefs.audioDeviceId,
      videoEnabled,
      audioEnabled,
    });
  }

  function getStream() {
    return stream;
  }

  function isGranted() {
    return !!stream && stream.active;
  }

  window.addEventListener('beforeunload', stop);

  return {
    PREFS_KEY,
    isSecureContext,
    hasMediaDevices,
    getPermissionState,
    getErrorMessage,
    loadPrefs,
    savePrefs,
    requestAccess,
    ensureAccess,
    enumerateDevices,
    attachPreview,
    setVideoEnabled,
    setAudioEnabled,
    switchDevice,
    setAudioOutput,
    getStream,
    isGranted,
    stop,
    get videoEnabled() {
      return videoEnabled;
    },
    get audioEnabled() {
      return audioEnabled;
    },
  };
})();
