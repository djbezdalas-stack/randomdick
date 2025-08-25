// Utility: load CSV
async function loadCards() {
  const response = await fetch("clash_royale_cards.csv");
  const text = await response.text();
  const rows = text.trim().split("\n");
  return rows.map(row => {
    const [name, elixir, rarity, id] = row.split(",");
    return {
      name,
      rarity: rarity.toLowerCase(),
      elixir: parseFloat(elixir),
      id,
      image: `./card_images/${id}.png`
    };
  });
}

// Update slider display with RANDOM support
function updateSliderValue(sliderId, valueId, maxRandom) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(valueId);

  function setDisplay(val) {
    display.textContent = (val == 0) ? "RANDOM" : val;
  }
  slider.addEventListener('input', () => setDisplay(slider.value));
  setDisplay(slider.value);

  // if value is 0, assign random when generating
  return () => {
    let val = parseInt(slider.value);
    if(val === 0) return Math.floor(Math.random() * (maxRandom+1));
    return val;
  }
}

// Initialize sliders
const getElixir = updateSliderValue('elixirRange','elixirValue',8);
const getCommon = updateSliderValue('commonRange','commonValue',8);
const getRare = updateSliderValue('rareRange','rareValue',8);
const getEpic = updateSliderValue('epicRange','epicValue',8);
const getLegendary = updateSliderValue('legendaryRange','legendaryValue',8);
const getChampion = updateSliderValue('championRange','championValue',1);

const maxCards = 8;
const sliders = [
  { id: 'commonRange', label: 'Common' },
  { id: 'rareRange', label: 'Rare' },
  { id: 'epicRange', label: 'Epic' },
  { id: 'legendaryRange', label: 'Legendary' },
  { id: 'championRange', label: 'Champion' }
];

function getSliderValue(id) {
  return parseInt(document.getElementById(id).value, 10) || 0;
}

function setSliderValue(id, value) {
  document.getElementById(id).value = value;
  document.getElementById(id.replace('Range', 'Value')).textContent = value;
}

function showError(msg) {
  let err = document.getElementById('error');
  if (!err) {
    err = document.createElement('div');
    err.id = 'error';
    err.style.color = '#ff4d4d';
    err.style.textAlign = 'center';
    err.style.marginTop = '10px';
    document.querySelector('.panel').appendChild(err);
  }
  err.textContent = msg || '';
}

function updateSliders(changedId) {
  let total = sliders.reduce((sum, s) => sum + getSliderValue(s.id), 0);
  if (total > maxCards) {
    // Prevent increasing above maxCards
    let over = total - maxCards;
    let current = getSliderValue(changedId);
    setSliderValue(changedId, current - over);
    showError(`Total cards cannot exceed ${maxCards}.`);
  } else {
    showError('');
  }
}

sliders.forEach(s => {
  document.getElementById(s.id).addEventListener('input', () => updateSliders(s.id));
});

async function generateDeck() {
  const cards = await loadCards();

  // Get slider values (random if 0)
  let rarities = {
    common: getCommon(),
    rare: getRare(),
    epic: getEpic(),
    legendary: getLegendary(),
    champion: getChampion() > 1 ? 1 : getChampion(),
  };

  let targetElixir = parseFloat(document.getElementById('elixirRange').value);
  let useTarget = targetElixir > 0;

  let tries = 0, deck = [], avg = 0;
  do {
    // If all sliders are 0, randomize total 8 cards
    let totalSelected = Object.values(rarities).reduce((a, b) => a + b, 0);
    if (totalSelected === 0) {
      deck = pickRandom(cards, 8);
    } else {
      deck = [];
      let usedIds = new Set();
      Object.entries(rarities).forEach(([rarity, count]) => {
        const pool = cards.filter(c => c.rarity === rarity && !usedIds.has(c.id));
        for (let i = 0; i < count && pool.length; i++) {
          const card = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
          deck.push(card);
          usedIds.add(card.id);
        }
      });
      if (deck.length < maxCards) {
        const remaining = cards.filter(c => !usedIds.has(c.id));
        deck = deck.concat(pickRandom(remaining, maxCards - deck.length));
      }
      deck = deck.slice(0, maxCards);
    }
    avg = deck.length > 0 ? (deck.reduce((sum, c) => sum + c.elixir, 0) / deck.length) : 0;
    tries++;
    // If not using target, break after first deck
    if (!useTarget) break;
    // If using target, repeat until within ±0.2 or 1000 tries
  } while (useTarget && Math.abs(avg - targetElixir) > 0.2 && tries < 1000);

  if (useTarget && Math.abs(avg - targetElixir) > 0.2) {
    showError(`Couldn't match target elixir (${targetElixir}) after 1000 tries.`);
  } else {
    showError('');
  }

  renderDeck(deck, avg);
}

// Utility to pick n random cards from array
function pickRandom(arr, n) {
  const src = arr.slice(), out = [];
  n = Math.min(n, src.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * src.length);
    out.push(src[idx]);
    src.splice(idx, 1);
  }
  return out;
}

// Render deck in 4 columns, 2 rows, launch button at bottom
function renderDeck(deck, avg) {
  const deckContainer = document.getElementById("deck");
  deckContainer.innerHTML = "";

  deckContainer.style.display = "grid";
  deckContainer.style.gridTemplateColumns = "repeat(4, 1fr)";
  deckContainer.style.gridTemplateRows = "repeat(2, 1fr)";
  deckContainer.style.gap = "7.5px";

  deck.forEach(card => {
    const div = document.createElement("div");
    div.className = `card ${card.rarity}`;
    const img = document.createElement("img");
    img.src = card.image;
    img.alt = card.name;
    div.appendChild(img);
    deckContainer.appendChild(div);
  });

  // Display average elixir
  document.getElementById("avgElixir").textContent = `Average elixir cost: ${avg.toFixed(1)}`;

  // Deck link (new format)
  const deckIds = deck.map(c => c.id).join(";");
  const deckLabel = "Royals"; // or let user choose
  const deckThumb = "159000000"; // default to King icon, or pick first card id
  const deckUrl = `https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=${deckIds}&l=${deckLabel}&tt=${deckThumb}`;

  // Remove old launch button if present
  let oldBtn = document.getElementById("launchBtn");
  if (oldBtn) oldBtn.remove();

  // Create and append launch button
  const launchBtn = document.createElement('a');
  launchBtn.id = "launchBtn";
  launchBtn.className = "launch-btn";
  launchBtn.textContent = "Launch in Clash Royale";
  launchBtn.target = "_blank";
  launchBtn.href = deckUrl;
  // Remove width: 100% to avoid stretching
  launchBtn.style.marginTop = "10px";
  launchBtn.style.fontFamily = "'YouBlockhead', sans-serif";
  launchBtn.style.fontWeight = "bold";
  launchBtn.style.fontSize = "1.1rem";
  document.querySelector(".panel").appendChild(launchBtn);
}

document.getElementById("generateBtn").addEventListener("click", generateDeck);

// Generate first deck on page load
window.addEventListener("load", generateDeck);
