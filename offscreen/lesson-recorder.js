let recorderState = null;
let lessonAudioDb = null;

function openLessonAudioDb() {
  if (lessonAudioDb) return Promise.resolve(lessonAudioDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('open-chat-hub-lessons', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
    };
    req.onsuccess = () => {
      lessonAudioDb = req.result;
      resolve(lessonAudioDb);
    };
    req.onerror = () => reject(req.error || new Error('Unable to open lesson audio database'));
  });
}

async function saveLessonAudio(audioId, blob) {
  const db = await openLessonAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('audio', 'readwrite');
    tx.objectStore('audio').put(blob, audioId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Unable to save lesson audio'));
  });
}

async function getTabAudioStream(streamId) {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });
}

function stopTracks(streams) {
  streams.forEach(stream => stream?.getTracks().forEach(track => track.stop()));
}

function startAudioLevelBroadcast(state) {
  if (!state?.analyser) return;
  const data = state.levelData || new Uint8Array(state.analyser.fftSize);
  state.levelData = data;

  const tick = () => {
    if (recorderState !== state) return;
    if (state.recorder?.state === 'paused') {
      state.levelTimer = setTimeout(tick, 180);
      return;
    }

    state.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const centered = (data[i] - 128) / 128;
      sum += centered * centered;
    }

    const rms = Math.sqrt(sum / data.length);
    chrome.runtime.sendMessage({
      type: 'LESSON_AUDIO_LEVEL',
      level: Math.min(1, rms * 5.8)
    }).catch(() => {});
    state.levelTimer = setTimeout(tick, 90);
  };

  tick();
}

function stopAudioLevelBroadcast(state) {
  if (state?.levelTimer) {
    clearTimeout(state.levelTimer);
    state.levelTimer = null;
  }
}

async function startRecording(streamId) {
  if (recorderState) throw new Error('Lesson recording is already running');
  const AudioContextCtor = self.AudioContext || self.webkitAudioContext;
  if (!AudioContextCtor) throw new Error('AudioContext is not available');

  const tabStream = await getTabAudioStream(streamId);
  let micStream = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    micStream = null;
  }

  const audioContext = new AudioContextCtor();
  const destination = audioContext.createMediaStreamDestination();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;
  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(destination);
  tabSource.connect(analyser);
  tabSource.connect(audioContext.destination);

  if (micStream) {
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
    micSource.connect(analyser);
  }

  const recorderOptions = MediaRecorder.isTypeSupported?.('audio/webm') ? { mimeType: 'audio/webm' } : {};
  const recorder = new MediaRecorder(destination.stream, recorderOptions);
  const chunks = [];
  recorder.ondataavailable = event => {
    if (event.data?.size) chunks.push(event.data);
  };
  recorder.start(1000);

  recorderState = {
    recorder,
    chunks,
    streams: [tabStream, micStream].filter(Boolean),
    audioContext,
    analyser,
    levelData: new Uint8Array(analyser.fftSize),
    levelTimer: null,
    startedAt: Date.now(),
    pausedAt: null,
    pausedMs: 0,
    hasMic: Boolean(micStream)
  };

  startAudioLevelBroadcast(recorderState);
  return { hasMic: recorderState.hasMic };
}

async function pauseRecording() {
  if (!recorderState) throw new Error('Lesson recording is not running');
  if (recorderState.recorder.state !== 'recording') return { paused: true };
  recorderState.recorder.pause();
  recorderState.pausedAt = Date.now();
  return { paused: true };
}

async function resumeRecording() {
  if (!recorderState) throw new Error('Lesson recording is not running');
  if (recorderState.recorder.state !== 'paused') return { paused: false };
  if (recorderState.pausedAt) {
    recorderState.pausedMs += Date.now() - recorderState.pausedAt;
    recorderState.pausedAt = null;
  }
  recorderState.recorder.resume();
  return { paused: false };
}

async function stopRecording() {
  if (!recorderState) throw new Error('Lesson recording is not running');
  const state = recorderState;
  recorderState = null;
  stopAudioLevelBroadcast(state);
  const stopped = new Promise(resolve => {
    state.recorder.onstop = resolve;
  });
  state.recorder.stop();
  await stopped;
  stopTracks(state.streams);
  await state.audioContext.close().catch(() => {});
  if (!state.chunks.length) throw new Error('Recording did not capture audio data');

  const blob = new Blob(state.chunks, { type: state.chunks[0]?.type || 'audio/webm' });
  const finishedAt = Date.now();
  const pausedMs = state.pausedMs + (state.pausedAt ? finishedAt - state.pausedAt : 0);
  const audioId = `lesson_audio_${finishedAt}`;
  await saveLessonAudio(audioId, blob);
  return {
    audioId,
    audioType: blob.type,
    audioSize: blob.size,
    durationMs: finishedAt - state.startedAt - pausedMs,
    startedAt: state.startedAt,
    finishedAt,
    hasMic: state.hasMic
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'lesson-recorder-offscreen') return false;

  if (message.type === 'LESSON_OFFSCREEN_START') {
    startRecording(message.streamId)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'LESSON_OFFSCREEN_STOP') {
    stopRecording()
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'LESSON_OFFSCREEN_PAUSE') {
    pauseRecording()
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'LESSON_OFFSCREEN_RESUME') {
    resumeRecording()
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  return false;
});
