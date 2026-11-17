const VOICES = ['Laura', 'Harold', 'Luis'];
const LETTERS = ['A', 'B', 'C'];
const STORAGE_KEY = 'blind-bible-voice-evaluation-v1';

const passageList = document.querySelector('#passage-list');
const stats = document.querySelector('#stats');
const ballotPreview = document.querySelector('#ballot-preview');
const copyStatus = document.querySelector('#copy-status');

function readBallot() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

let ballot = readBallot();

function writeBallot() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ballot));
  copyStatus.textContent = 'Saved in this browser.';
  window.clearTimeout(writeBallot.statusTimer);
  writeBallot.statusTimer = window.setTimeout(() => { copyStatus.textContent = ''; }, 1800);
}

function passageChoices(passageId) {
  ballot[passageId] ??= { models: {}, likedVoices: [] };
  ballot[passageId].models ??= {};
  ballot[passageId].likedVoices ??= [];
  return ballot[passageId];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function makeVoiceCard(passage, voice, passageIndex, voiceIndex) {
  const key = `${passage.id}-${voice.toLowerCase()}`;
  const selected = passageChoices(passage.id).models[voice] || '';
  const audioRoot = `audio/${passage.id}/${voice}`;
  const options = LETTERS.map((letter) => `
    <label class="choice-option">
      <input type="radio" name="model-${key}" value="${letter}" ${selected === letter ? 'checked' : ''}>
      <span>${letter}</span>
    </label>`).join('');
  const clips = LETTERS.map((letter) => `
    <div class="audio-row">
      <span class="clip-label">${letter}</span>
      <audio controls preload="none" aria-label="${escapeHtml(passage.reference)}, ${voice}, clip ${letter}" src="${audioRoot}/${letter}.mp3"></audio>
    </div>`).join('');

  return `
    <details class="voice-card" ${passageIndex === 0 && voiceIndex === 0 ? 'open' : ''}>
      <summary class="voice-summary">
        <span class="voice-name">${voice}</span>
        <span class="voice-hint">3 recordings</span>
      </summary>
      <div class="voice-content">
        <div class="audio-list">${clips}</div>
        <fieldset class="model-choice">
          <legend>Which reading do you prefer?</legend>
          <div class="choice-list">${options}</div>
        </fieldset>
      </div>
    </details>`;
}

function makePassageCard(passage, index) {
  const chosenVoices = passageChoices(passage.id).likedVoices;
  const voiceChecks = VOICES.map((voice) => `
    <label class="check-option">
      <input type="checkbox" value="${voice}" data-passage="${passage.id}" data-kind="liked-voice" ${chosenVoices.includes(voice) ? 'checked' : ''}>
      <span>${voice}</span>
    </label>`).join('');
  const voices = VOICES.map((voice, voiceIndex) => makeVoiceCard(passage, voice, index, voiceIndex)).join('');

  return `
    <details class="passage-card" ${index === 0 ? 'open' : ''}>
      <summary class="passage-summary">
        <span>
          <span class="passage-name">${escapeHtml(passage.title)}</span><br>
          <span class="passage-reference">${escapeHtml(passage.reference)}</span>
        </span>
        <span class="clip-count">9 recordings</span>
      </summary>
      <div class="passage-content">
        <blockquote class="scripture">${escapeHtml(passage.text)}</blockquote>
        <div class="voice-list">${voices}</div>
        <fieldset class="liked-voices">
          <legend>Which voices did you like? Select any that apply.</legend>
          <div class="check-list">${voiceChecks}</div>
        </fieldset>
      </div>
    </details>`;
}

function tally() {
  const model = { A: 0, B: 0, C: 0 };
  const voice = Object.fromEntries(VOICES.map((name) => [name, 0]));
  let comparisons = 0;
  let favoriteMarks = 0;
  for (const result of Object.values(ballot)) {
    for (const choice of Object.values(result.models || {})) {
      if (model[choice] !== undefined) {
        model[choice] += 1;
        comparisons += 1;
      }
    }
    for (const name of result.likedVoices || []) {
      if (voice[name] !== undefined) {
        voice[name] += 1;
        favoriteMarks += 1;
      }
    }
  }
  return { model, voice, comparisons, favoriteMarks };
}

function statCard(title, counts, total, singular) {
  const chips = Object.entries(counts).map(([name, count]) => `
    <div class="stat-chip"><strong>${count}</strong><span>${escapeHtml(name)}</span></div>`).join('');
  return `
    <div class="stat-card">
      <p class="stat-title">${escapeHtml(title)} · ${total} ${total === 1 ? singular : `${singular}s`}</p>
      <div class="stat-values">${chips}</div>
    </div>`;
}

function buildSummary(passages) {
  const rows = passages.map((passage) => {
    const result = passageChoices(passage.id);
    const modelSummary = VOICES.map((voice) => `${voice} ${result.models[voice] || '—'}`).join(', ');
    const liked = VOICES.filter((voice) => result.likedVoices.includes(voice));
    return `• ${passage.reference}: ${modelSummary}; liked voices: ${liked.length ? liked.join(', ') : '—'}`;
  });
  const counts = tally();
  const bestModel = maxNames(counts.model);
  const bestVoices = maxNames(counts.voice);
  const overall = [
    `Overall model preference: ${bestModel.length ? bestModel.join(' / ') : 'not enough choices yet'}`,
    `Overall liked voice(s): ${bestVoices.length ? bestVoices.join(' / ') : 'not selected yet'}`
  ];
  return [
    'My blind Bible reading preferences',
    ...rows,
    ...overall,
    '',
    'A/B/C are blind model labels. My choices were made by listening to the recordings.'
  ].join('\n');
}

function maxNames(counts) {
  const max = Math.max(0, ...Object.values(counts));
  if (max === 0) return [];
  return Object.entries(counts).filter(([, value]) => value === max).map(([name]) => name);
}

function renderSummary(passages) {
  const counts = tally();
  stats.innerHTML = statCard('Preferred model reading', counts.model, counts.comparisons, 'choice')
    + statCard('Voices you liked', counts.voice, counts.favoriteMarks, 'selection');
  ballotPreview.textContent = buildSummary(passages);
}

async function init() {
  const response = await fetch('data/passages.json');
  if (!response.ok) throw new Error('Could not load the passage list.');
  const passages = await response.json();
  passageList.innerHTML = passages.map(makePassageCard).join('');
  renderSummary(passages);

  passageList.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const passageId = input.dataset.passage || input.name.replace(/^model-/, '').replace(/-[^-]+$/, '');
    const result = passageChoices(passageId);
    if (input.dataset.kind === 'liked-voice') {
      result.likedVoices = [...passageList.querySelectorAll(`input[data-passage="${passageId}"][data-kind="liked-voice"]:checked`)].map((item) => item.value);
    } else if (input.type === 'radio' && input.checked) {
      const voice = VOICES.find((name) => input.name === `model-${passageId}-${name.toLowerCase()}`);
      if (voice) result.models[voice] = input.value;
    }
    writeBallot();
    renderSummary(passages);
  });

  document.querySelector('#copy-ballot').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildSummary(passages));
      copyStatus.textContent = 'Copied. Paste it into Discord.';
    } catch {
      copyStatus.textContent = 'Copy was blocked by the browser. Select the preview text and copy it.';
      document.querySelector('.summary-details').open = true;
    }
  });

  document.querySelector('#clear-ballot').addEventListener('click', () => {
    if (!window.confirm('Clear all choices saved in this browser?')) return;
    ballot = {};
    localStorage.removeItem(STORAGE_KEY);
    passageList.innerHTML = passages.map(makePassageCard).join('');
    renderSummary(passages);
    copyStatus.textContent = 'Choices cleared.';
    window.setTimeout(() => { copyStatus.textContent = ''; }, 1800);
  });
}

init().catch((error) => {
  passageList.innerHTML = `<p class="load-error">${escapeHtml(error.message)}</p>`;
});
