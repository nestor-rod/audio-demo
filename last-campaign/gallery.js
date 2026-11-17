const VOICES = ['Ben', 'Mark', 'Emma', 'Melora'];
const VERSIONS = [
  { id: 'version-1', label: 'Version 1' },
  { id: 'version-2', label: 'Version 2' }
];

const passageList = document.querySelector('#passage-list');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function makeVoiceCard(passage, voice, passageIndex, voiceIndex) {
  const audioRoot = `audio/${passage.id}/${voice.toLowerCase()}`;
  const recordings = VERSIONS.map(({ id, label }) => `
    <div class="audio-row version-row">
      <span class="clip-label version-label">${label}</span>
      <audio controls preload="none" aria-label="${escapeHtml(passage.reference)}, ${voice}, ${label}" src="${audioRoot}/${id}.mp3"></audio>
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
        <blockquote class="scripture">${escapeHtml(passage.text)}</blockquote>
        <div class="voice-list">${voices}</div>
      </div>
    </details>`;
}

async function init() {
  const response = await fetch('data/passages.json');
  if (!response.ok) throw new Error('Could not load the passage list.');
  const passages = await response.json();
  passageList.innerHTML = passages.map(makePassageCard).join('');
}

init().catch((error) => {
  passageList.innerHTML = `<p class="load-error">${escapeHtml(error.message)}</p>`;
});
