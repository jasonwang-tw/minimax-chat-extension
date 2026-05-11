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
  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(destination);
  tabSource.connect(audioContext.destination);

  if (micStream) {
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
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
    startedAt: Date.now(),
    pausedAt: null,
    pausedMs: 0,
    hasMic: Boolean(micStream)
  };

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
