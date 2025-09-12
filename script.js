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
function setupSlider(sliderId, valueId) {
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
const getCommon     = setupSlider('commonRange','commonValue');
const getRare       = setupSlider('rareRange','rareValue');
const getEpic       = setupSlider('epicRange','epicValue');
const getLegendary  = setupSlider('legendaryRange','legendaryValue');
const getChampion   = setupSlider('championRange','championValue');

// Archetype sliders
const getTroop        = setupSlider('troopRange','troopValue');
const getTroopAir     = setupSlider('troopAirRange','troopAirValue');
const getTroopGround  = setupSlider('troopGroundRange','troopGroundValue');
const getSpell        = setupSlider('spellRange','spellValue');
const getBuilding     = setupSlider('buildingRange','buildingValue');

// Elixir slider (if present)
const getElixir = setupSlider('elixirRange','elixirValue');

const maxCards = 8;

// Sliders that count toward budget
const budgetSliderIds = [
  'commonRange','rareRange','epicRange','legendaryRange','championRange',
  'troopRange','troopAirRange','troopGroundRange','spellRange','buildingRange'
];

// Utility: pick n random items
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

// Show error text
function showError(msg) {
  const err = document.getElementById('error');
  if (err) err.textContent = msg || '';
}

// ---- DECK GENERATION ----
async function generateDeck() {
  const cards = await loadCards();

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

  // Mastery filter
  const masteryRangeEl = document.getElementById("masteryRange");
  const maxMastery = Number(masteryRangeEl?.value ?? 10);
  if (masteryRangeEl && !masteryRangeEl.disabled && maxMastery < 10) {
    if (!window.masteryData) {
      showError("Mastery filters require fetching player data first!");
      return;
    }
    pool = pool.filter(c => {
  const m = window.masteryData.find(mm => mm.name === c.name);
  const lvl = m ? m.level : 0; // unmapped = level 0
  return lvl <= maxMastery;
});
  }

  // Exclude 0
  for (const [rarity, v] of Object.entries(rarityValues)) {
    if (v === 0) pool = pool.filter(c => c.rarity !== rarity);
  }
  for (const [arch, v] of Object.entries(archetypeValues)) {
    if (v === 0) {
      if (arch === 'troop') pool = pool.filter(c => !c.archetype.startsWith('troop'));
      else pool = pool.filter(c => c.archetype !== arch);
    }
  }

  if (pool.length < maxCards) {
    showError("Not enough cards after exclusions to build a full deck.");
    return;
  }

  // Requirements
  const reqs = [];
  for (const [arch, v] of Object.entries(archetypeValues)) if (v > 0) reqs.push({ kind:'arch', key:arch, want:v });
  for (const [rar,  v] of Object.entries(rarityValues))    if (v > 0) reqs.push({ kind:'rar',  key:rar,  want:v });
  reqs.sort((a,b) => (a.kind !== b.kind) ? (a.kind === 'arch' ? -1 : 1) : (b.want - a.want));

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
          chosen.push(...pickRandom(champs, 1));
        }
        deck.push(...chosen);
        const chosenIds = new Set(chosen.map(x => x.id));
        pool = pool.filter(c => !chosenIds.has(c.id));
        if (chosen.some(c => c.rarity === 'champion')) {
          pool = pool.filter(c => c.rarity !== 'champion');
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
          pool = pool.filter(c => c.rarity !== 'champion');
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

  // Fill random
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

// ---- RENDER DECK ----
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
    div.innerHTML = `<img class="card-img" src="${card.image}" alt="${card.name}">`;
    deckContainer.appendChild(div);
  });

  const avgElixirEl = document.getElementById("avgElixir");
  if (avgElixirEl) avgElixirEl.textContent = `Average elixir cost: ${avg.toFixed(1)}`;

  const deckIds = deck.map(c => c.id).join(";");
  const deckLabel = "Royals";
  const deckThumb = "159000000";
  const deckUrl = `https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=${deckIds}&l=${deckLabel}&tt=${deckThumb}`;

  const launchBtn = document.getElementById("launchBtn");
  if (launchBtn) launchBtn.href = deckUrl;
}

// ---- BUDGET UI ----
function updateBudgetUI() {
  const sliders = budgetSliderIds.map(id => document.getElementById(id)).filter(Boolean);
  const values = sliders.map(s => parseInt(s.value, 10));
  const sum = values.reduce((a, v) => a + (v > 0 ? v : 0), 0);
  const overBudget = sum > maxCards;

  sliders.forEach(s => {
    const isModified = parseInt(s.value, 10) > 0;
    if (isModified) {
      s.style.outline = '2px solid #ffb300';
      s.style.boxShadow = '0 0 0 2px #ffb30044';
    } else {
      s.style.outline = '';
      s.style.boxShadow = '';
    }
    s.disabled = overBudget ? !isModified : false;
  });

  if (overBudget) {
    showError(`You requested ${sum} cards via sliders (max is ${maxCards}). Reduce the highlighted sliders.`);
  } else {
    const err = document.getElementById('error');
    if (err && err.textContent.startsWith("You requested")) showError('');
  }
}

// Attach listeners
budgetSliderIds.forEach(id => {
  const s = document.getElementById(id);
  if (s) s.addEventListener('input', updateBudgetUI);
});
const generateBtn = document.getElementById("generateBtn");
if (generateBtn) generateBtn.addEventListener("click", generateDeck);
window.addEventListener('load', updateBudgetUI);

// Auto-generate on load
window.addEventListener("load", () => {
  const deckContainer = document.getElementById("deck");
  if (deckContainer && deckContainer.children.length === 0) {
    generateDeck();
  }
});

// ---- MASTERY UI ----
const masterySlider = document.getElementById("masteryRange");
const masteryValue = document.getElementById("masteryValue");
const lookupBtn = document.getElementById("lookupBtn");
const playerTagInput = document.getElementById("playerTagInput");
const output = document.getElementById("output");
const masteryToggle = document.getElementById("masteryToggle");
const masterySection = document.getElementById("masterySection");

if (masterySlider) masterySlider.disabled = true;

if (masteryToggle && masterySection) {
  masteryToggle.addEventListener('click', () => {
    const expanded = masterySection.classList.toggle('hidden');
    masteryToggle.textContent = expanded ? '▶ Mastery Filter' : '▼ Mastery Filter';
  });
}

let lookupCooldown = null;
if (lookupBtn) {
  lookupBtn.addEventListener('click', async () => {
    const tag = (playerTagInput?.value || '').trim();
    if (!tag) {
      showError('Please enter player tag.');
      return;
    }

    lookupBtn.disabled = true;
    let seconds = 60;
    const origText = lookupBtn.textContent;
    lookupBtn.textContent = `Wait ${seconds}s`;
    lookupCooldown = setInterval(() => {
      seconds--;
      lookupBtn.textContent = seconds > 0 ? `Wait ${seconds}s` : origText;
      if (seconds <= 0) {
        clearInterval(lookupCooldown);
        lookupBtn.disabled = false;
      }
    }, 1000);

    try {
  const res = await fetch(`https://randomdick.vercel.app/api/player?tag=${encodeURIComponent(tag)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // Ensure CSV cards are loaded
  const allCards = (window.allCards && window.allCards.length) ? window.allCards : await loadCards();
  window.allCards = allCards;

  const masteryBadges = (data.badges || []).filter(b => b.name && b.name.startsWith("Mastery"));

  const masteryData = masteryBadges.map(m => {
    const card = allCards.find(c => c.masteryName === m.name);

    if (!card) {
      console.error(`[Mastery mapping error] No CSV entry for badge: "${m.name}"`);
    }

    return {
      cardName: card ? card.name : m.name.replace(/^Mastery\s*/, "").trim(),
      level: Number(m.level ?? 0),
      maxLevel: Number(m.maxLevel ?? 0),
      matched: !!card
    };
  });

  window.masteryData = masteryData;

  if (!masteryData.length) {
    output.textContent = "No card masteries found for this player.";
    window.masteryData = null;
    if (masterySlider) masterySlider.disabled = true;
    showError('No card masteries found for this player.');
    return;
  }

  if (masterySlider) {
    masterySlider.disabled = false;
    masterySlider.value = String(masterySlider.max || 10);
    masteryValue.textContent = masterySlider.value;
    masterySlider.oninput = () => {
      masteryValue.textContent = masterySlider.value;
    };
  }

  // Format output into aligned columns
  const header = ["Name", "Level", "Max"];
  const rows = masteryData.map(m =>
    `${m.name.padEnd(20)} ${String(m.level).padStart(2)} / ${m.maxLevel}`
  );
  output.textContent = [header.join(" | "), ...rows].join("\n");

  // ✅ Success message
  output.insertAdjacentHTML("beforebegin",
    `<div class="success">Player data successfully fetched!</div>`);

  showError('');

} catch (err) {
  output.textContent = "";
  showError("Error fetching player: " + (err.message || err));
  window.masteryData = null;
  if (masterySlider) masterySlider.disabled = true;
}
  });
}
