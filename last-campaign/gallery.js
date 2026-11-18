const VOICES = ['Ben', 'Mark', 'Emma', 'Melora'];
const VERSIONS = [
  { id: 'version-1', label: 'Version 1' },
  { id: 'version-2', label: 'Version 2' }
];
const MIN_WORD_HIGHLIGHT_MS = 80;

const passageList = document.querySelector('#passage-list');
let activeAudioState = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function renderAlignedText(text) {
  const pattern = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g;
  let cursor = 0;
  let wordIndex = 0;
  let html = '';
  for (const match of text.matchAll(pattern)) {
    html += escapeHtml(text.slice(cursor, match.index));
    html += `<span class="aligned-word" data-word-index="${wordIndex++}">${escapeHtml(match[0])}</span>`;
    cursor = match.index + match[0].length;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

function makeVoiceCard(passage, voice, passageIndex, voiceIndex) {
  const voiceId = voice.toLowerCase();
  const audioRoot = `audio/${passage.id}/${voiceId}`;
  const recordings = VERSIONS.map(({ id, label }) => `
    <div class="audio-row version-row">
      <span class="clip-label version-label">${label}</span>
      <audio controls preload="none" data-passage="${passage.id}" data-voice="${voiceId}" data-version="${id}" aria-label="${escapeHtml(passage.reference)}, ${voice}, ${label}" src="${audioRoot}/${id}.mp3"></audio>
    </div>`).join('');

  return `
    <details class="voice-card" ${passageIndex === 0 && voiceIndex === 0 ? 'open' : ''}>
      <summary class="voice-summary">
        <span class="voice-name">${voice}</span>
        <span class="voice-hint">2 recordings</span>
      </summary>
      <div class="voice-content"><div class="audio-list">${recordings}</div></div>
    </details>`;
}

function makePassageCard(passage, index) {
  const voices = VOICES.map((voice, voiceIndex) => makeVoiceCard(passage, voice, index, voiceIndex)).join('');
  return `
    <details class="passage-card" ${index === 0 ? 'open' : ''}>
      <summary class="passage-summary">
        <span>
          <span class="passage-name">${escapeHtml(passage.title)}</span><br>
          <span class="passage-reference">${escapeHtml(passage.reference)}</span>
        </span>
        <span class="clip-count">8 recordings</span>
      </summary>
      <div class="passage-content">
        <blockquote class="scripture" data-scripture="${passage.id}">${renderAlignedText(passage.text)}</blockquote>
        <div class="voice-list">${voices}</div>
      </div>
    </details>`;
}

function clearActiveWord(state) {
  if (state?.activeElement) state.activeElement.classList.remove('is-speaking');
  if (state) state.activeElement = null;
}

function setActiveWord(state, wordIndex) {
  if (state.activeIndex === wordIndex) return;
  clearActiveWord(state);
  state.activeIndex = wordIndex;
  const element = state.elements.get(wordIndex);
  if (element) {
    element.classList.add('is-speaking');
    state.activeElement = element;
  }
  state.activeSince = performance.now();
}

function targetWordIndex(words, time) {
  let low = 0;
  let high = words.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (words[middle].s <= time) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

function queueWordsThroughTime(state, time) {
  const target = targetWordIndex(state.words, time);
  for (let i = state.lastQueuedIndex + 1; i <= target; i++) state.queue.push(i);
  if (target > state.lastQueuedIndex) state.lastQueuedIndex = target;
}

function updateHighlight(state) {
  queueWordsThroughTime(state, state.audio.currentTime);
  const enoughDwell = performance.now() - state.activeSince >= MIN_WORD_HIGHLIGHT_MS;
  if (state.queue.length && (state.activeIndex === null || enoughDwell)) {
    const next = state.queue.shift();
    setActiveWord(state, state.words[next].i);
  }
  if (!state.audio.paused && !state.audio.ended) {
    state.frame = requestAnimationFrame(() => updateHighlight(state));
  } else {
    state.frame = 0;
  }
}

function startHighlighting(state) {
  if (activeAudioState && activeAudioState !== state) {
    if (activeAudioState.frame) cancelAnimationFrame(activeAudioState.frame);
    activeAudioState.audio.pause();
    clearActiveWord(activeAudioState);
  }
  activeAudioState = state;
  if (!state.frame) updateHighlight(state);
}

function resetHighlightToPlayhead(state) {
  state.queue = [];
  const target = targetWordIndex(state.words, state.audio.currentTime);
  state.lastQueuedIndex = target;
  setActiveWord(state, target >= 0 ? state.words[target].i : null);
}

function connectAudioToAlignment(passages, alignmentData) {
  document.querySelectorAll('audio[data-passage][data-voice][data-version]').forEach((audio) => {
    const passageId = audio.dataset.passage;
    const voiceId = audio.dataset.voice;
    const versionId = audio.dataset.version;
    const words = alignmentData[passageId]?.[voiceId]?.[versionId] || [];
    const track = document.querySelector(`[data-scripture="${passageId}"]`);
    const elements = new Map([...track.querySelectorAll('.aligned-word')]
      .map((element) => [Number(element.dataset.wordIndex), element]));
    const state = {
      audio,
      words: words.filter((word) => Number.isFinite(word.s) && Number.isFinite(word.e)).sort((a, b) => a.s - b.s),
      elements,
      activeIndex: null,
      activeElement: null,
      activeSince: 0,
      lastQueuedIndex: -1,
      queue: [],
      frame: 0
    };

    audio.addEventListener('play', () => startHighlighting(state));
    audio.addEventListener('timeupdate', () => queueWordsThroughTime(state, audio.currentTime));
    audio.addEventListener('seeked', () => resetHighlightToPlayhead(state));
    audio.addEventListener('pause', () => {
      if (state.frame) cancelAnimationFrame(state.frame);
      state.frame = 0;
      queueWordsThroughTime(state, audio.currentTime);
      if (state.queue.length) setActiveWord(state, state.words[state.queue[state.queue.length - 1]].i);
      state.queue = [];
    });
    audio.addEventListener('ended', () => {
      if (state.frame) cancelAnimationFrame(state.frame);
      state.frame = 0;
      state.queue = [];
      state.lastQueuedIndex = -1;
      setActiveWord(state, null);
      if (activeAudioState === state) activeAudioState = null;
    });
  });
}

async function init() {
  const [passageResponse, alignmentResponse] = await Promise.all([
    fetch('data/passages.json'),
    fetch('data/whisperx-alignments.json')
  ]);
  if (!passageResponse.ok || !alignmentResponse.ok) throw new Error('Could not load the passage or timing data.');
  const [passages, alignmentData] = await Promise.all([passageResponse.json(), alignmentResponse.json()]);
  passageList.innerHTML = passages.map(makePassageCard).join('');
  connectAudioToAlignment(passages, alignmentData);
}

init().catch((error) => {
  passageList.innerHTML = `<p class="load-error">${escapeHtml(error.message)}</p>`;
});
