async function loadCards() {
  const res = await fetch("clash_royale_cards.csv");
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  const [, ...rows] = lines;

  function parseCSVLine(line) {
    return line.split(',').map(field => field.trim());
  }

  return rows.map(line => {
    const [name, elixir, rarity, id, archetype, masteryName] = parseCSVLine(line);
    const idTrim = (id || "").trim();
    return {
      name: (name || "").trim(),
      elixir: parseFloat((elixir || "").trim()),
      rarity: (rarity || "").toLowerCase().trim(),
      id: idTrim,
      archetype: (archetype || "").toLowerCase().trim(),
      image: `./card_images/${idTrim}.png`,
      masteryName: masteryName || ""
    };
  });
}


// Slider value display logic
function setupSlider(sliderId, valueId, maxRandom) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(valueId);

  if (!slider || !display) return () => -1;

  function setDisplay(val) {
    display.textContent = (val == -1) ? "Random" : val;
  }
  slider.addEventListener('input', () => setDisplay(slider.value));
  setDisplay(slider.value);

  return () => {
    let val = parseInt(slider.value);
    if (val === -1) return -1;
    return val;
  };
}

// Rarity sliders
const getCommon = setupSlider('commonRange','commonValue',8);
const getRare = setupSlider('rareRange','rareValue',8);
const getEpic = setupSlider('epicRange','epicValue',8);
const getLegendary = setupSlider('legendaryRange','legendaryValue',8);
const getChampion = setupSlider('championRange','championValue',1);

// Archetype sliders
const getTroop = setupSlider('troopRange','troopValue',8);
const getTroopAir = setupSlider('troopAirRange','troopAirValue',8);
const getTroopGround = setupSlider('troopGroundRange','troopGroundValue',8);
const getSpell = setupSlider('spellRange','spellValue',8);
const getBuilding = setupSlider('buildingRange','buildingValue',8);

// Elixir slider
const getElixir = setupSlider('elixirRange','elixirValue',8);

const maxCards = 8;

// All sliders that contribute to the 8-card budget
const budgetSliderIds = [
  'commonRange','rareRange','epicRange','legendaryRange','championRange',
  'troopRange','troopAirRange','troopGroundRange','spellRange','buildingRange'
];

// Utility: pick n random items from array
function pickRandom(arr, n) {
  const copy = arr.slice();
  const result = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

// Utility: show error message
function showError(msg) {
  const err = document.getElementById('error');
  if (err) err.textContent = msg;
}

// Mastery filter
const masterySlider = document.getElementById("masteryRange");
if (masterySlider) {
  const minMastery = Number(masterySlider.value || 0);

  if (minMastery > 0) {
    if (!window.masteryData) {
      showError("Mastery filters require fetching player data first!");
      return;
    }

    // Filter pool by mastery level
    pool = pool.filter(c => {
      if (!c.masteryName) return false;
      const m = window.masteryData.find(m => m.name === c.masteryName);
      return m && m.level >= minMastery;
    });

    if (pool.length < maxCards) {
      showError("Not enough cards meet the mastery filter to build a full deck.");
      return;
    }
  }
}

async function generateDeck() {
  const cards = await loadCards();

  // Read sliders
  function safeValue(id) {
    const el = document.getElementById(id);
    return el ? Number(el.value) : 0;
  }
  const rarityValues = {
    common: safeValue('commonRange'),
    rare: safeValue('rareRange'),
    epic: safeValue('epicRange'),
    legendary: safeValue('legendaryRange'),
    champion: safeValue('championRange'),
  };
  const archetypeValues = {
    'troop':        safeValue('troopRange'),
    'troop-air':    safeValue('troopAirRange'),
    'troop-ground': safeValue('troopGroundRange'),
    'spell':        safeValue('spellRange'),
    'building':     safeValue('buildingRange'),
  };

  let pool = [...cards];
  let deck = [];
  const hasChampion = () => deck.some(c => c.rarity === 'champion');

 const maxMastery = Number(document.getElementById("masteryRange")?.value || 10);
  if (maxMastery < 10) {
  if (!window.masteryData) {
    showError("Mastery filters require fetching player data first!");
    return;
  }
  pool = pool.filter(c => {
    if (!c.masteryName) return false;
    const m = window.masteryData.find(m => m.name === c.masteryName);
    return m && m.level <= maxMastery;
  });
  }

  // Exclude sliders set to 0
  for (const [rarity, v] of Object.entries(rarityValues)) {
    if (v === 0) pool = pool.filter(c => c.rarity !== rarity);
  }
  for (const [arch, v] of Object.entries(archetypeValues)) {
    if (v === 0) {
      if (arch === 'troop') pool = pool.filter(c => !c.archetype.startsWith('troop'));
      else pool = pool.filter(c => c.archetype !== arch);
    }
  }

  // Sanity: can we fill 8 after exclusions?
  if (pool.length < maxCards) {
    showError("Not enough cards after exclusions to build a full deck.");
    return;
  }

  // Build requirements (val > 0 means “at least n”)
  const reqs = [];
  for (const [arch, v] of Object.entries(archetypeValues)) if (v > 0) reqs.push({ kind:'arch', key:arch, want:v });
  for (const [rar,  v] of Object.entries(rarityValues))    if (v > 0) reqs.push({ kind:'rar',  key:rar,  want:v });

  // Archetypes first, then larger counts
  reqs.sort((a,b) => (a.kind !== b.kind) ? (a.kind === 'arch' ? -1 : 1) : (b.want - a.want));

  // Satisfy requirements (best effort; cap to remaining slots/availability)
  for (const req of reqs) {
    if (deck.length >= maxCards) break;

    if (req.kind === 'arch') {
      let sub = req.key === 'troop'
        ? pool.filter(c => c.archetype.startsWith('troop'))
        : pool.filter(c => c.archetype === req.key);

      if (hasChampion()) sub = sub.filter(c => c.rarity !== 'champion');

      const remainingSlots = maxCards - deck.length;
      const take = Math.min(req.want, sub.length, remainingSlots);
      if (take > 0) {
        const non = sub.filter(c => c.rarity !== 'champion');
        const champs = hasChampion() ? [] : sub.filter(c => c.rarity === 'champion');

        const pickNon = Math.min(take, non.length);
        const chosen = pickRandom(non, pickNon);

        if (chosen.length < take && champs.length > 0) {
          chosen.push(...pickRandom(champs, 1)); // at most one champ here
        }

        deck.push(...chosen);
        const chosenIds = new Set(chosen.map(x => x.id));
        pool = pool.filter(c => !chosenIds.has(c.id));

        if (chosen.some(c => c.rarity === 'champion')) {
          pool = pool.filter(c => c.rarity !== 'champion'); // purge remaining champs
        }
      }
    } else {
      if (req.key === 'champion') {
        if (!hasChampion()) {
          const champs = pool.filter(c => c.rarity === 'champion');
          const remainingSlots = maxCards - deck.length;
          const take = Math.min(1, champs.length, remainingSlots);
          const chosen = pickRandom(champs, take);
          deck.push(...chosen);
          const chosenIds = new Set(chosen.map(x => x.id));
          pool = pool.filter(c => !chosenIds.has(c.id));
          pool = pool.filter(c => c.rarity !== 'champion'); // purge others
        }
      } else {
        const subR = pool.filter(c => c.rarity === req.key);
        const remainingSlots = maxCards - deck.length;
        const take = Math.min(req.want, subR.length, remainingSlots);
        const chosen = pickRandom(subR, take);
        deck.push(...chosen);
        const chosenIds = new Set(chosen.map(x => x.id));
        pool = pool.filter(c => !chosenIds.has(c.id));
      }
    }
  }

  // Fill remaining slots randomly (still max 1 champion)
  if (hasChampion()) pool = pool.filter(c => c.rarity !== 'champion');

  const remaining = maxCards - deck.length;
  if (remaining > 0) {
    if (pool.length < remaining) {
      showError("Not enough cards to build a full deck after applying filters.");
      return;
    }
    deck.push(...pickRandom(pool, remaining));
  }

  const avg = deck.reduce((s, c) => s + c.elixir, 0) / deck.length;

  showError('');
  renderDeck(deck, avg);
}

function renderDeck(deck, avg) {
  const deckContainer = document.getElementById("deck");
  if (!deckContainer) return;
  deckContainer.innerHTML = "";
  deckContainer.style.display = "grid";
  deckContainer.style.gridTemplateColumns = "repeat(4, 1fr)";
  deckContainer.style.gridTemplateRows = "repeat(2, 1fr)";

  deck.forEach(card => {
    const div = document.createElement("div");
    div.className = `card ${card.rarity}`;
    div.innerHTML = `
      <img class="card-img" src="${card.image}" alt="${card.name}">
    `;
    deckContainer.appendChild(div);
  });

  // Display average elixir
  const avgElixirEl = document.getElementById("avgElixir");
  if (avgElixirEl) avgElixirEl.textContent = `Average elixir cost: ${avg.toFixed(1)}`;

  // Deck link (new format)
  const deckIds = deck.map(c => c.id).join(";");
  const deckLabel = "Royals";
  const deckThumb = "159000000";
  const deckUrl = `https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=${deckIds}&l=${deckLabel}&tt=${deckThumb}`;

  const launchBtn = document.getElementById("launchBtn");
if (launchBtn) {
  launchBtn.href = deckUrl;
}
}

function updateBudgetUI() {
  const sliders = budgetSliderIds.map(id => document.getElementById(id)).filter(Boolean);
  const values = sliders.map(s => parseInt(s.value, 10));
  const sum = values.reduce((a, v) => a + (v > 0 ? v : 0), 0);

  const overBudget = sum > maxCards;

  sliders.forEach(s => {
    const isModified = parseInt(s.value, 10) > 0;

    // highlight modified
    if (isModified) {
      s.style.outline = '2px solid #ffb300';
      s.style.boxShadow = '0 0 0 2px #ffb30044';
    } else {
      s.style.outline = '';
      s.style.boxShadow = '';
    }

    // lock unmodified if over budget
    s.disabled = overBudget ? !isModified : false;
  });

  if (overBudget) {
    showError(`You requested ${sum} cards via sliders (max is ${maxCards}). Reduce the highlighted sliders.`);
  } else {
    const err = document.getElementById('error');
    if (err && err.textContent.startsWith("You requested")) showError('');
  }
}

// attach listeners
budgetSliderIds.forEach(id => {
  const s = document.getElementById(id);
  if (s) s.addEventListener('input', updateBudgetUI);
});
const generateBtn = document.getElementById("generateBtn");
if (generateBtn) generateBtn.addEventListener("click", generateDeck);
window.addEventListener('load', updateBudgetUI);
window.addEventListener("load", () => {
  // Only generate deck if not already generated
  const deckContainer = document.getElementById("deck");
  if (deckContainer && deckContainer.children.length === 0) {
    generateDeck();
  }
});