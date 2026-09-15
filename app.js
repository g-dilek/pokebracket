// =========================================
// Pokémon Favorite Tournament
// =========================================
//
// Pokémon are loaded from pokelist.js.
//
// pokelist.js must be loaded BEFORE this file:
//
// <script src="pokelist.js"></script>
// <script src="app.js"></script>
// =========================================

// PokéAPI endpoint
const API_URL = "https://pokeapi.co/api/v2/pokemon/";

// =========================================
// State
// =========================================

let matchups = [];
let currentIndex = 0;
let deferred = [];
let wins = {};
let losses = {};
let results = {};

let tournamentSeed = null;

// Prevents accidental double-clicks while moving to the next matchup.
let isProcessingChoice = false;

// Increment this if fundamental change is made to pokelist.js
const POKEMON_LIST_VERSION = 1;

// =========================================
// DOM
// =========================================

const pokemonA = document.getElementById("pokemon-a");
const pokemonB = document.getElementById("pokemon-b");

const imageA = document.getElementById("image-a");
const imageB = document.getElementById("image-b");

const nameA = document.getElementById("name-a");
const nameB = document.getElementById("name-b");

const matchupNumber = document.getElementById("matchup-number");
const progressText = document.getElementById("progress-text");
const progressBar = document.getElementById("progress-bar");

const remainingCount = document.getElementById("remaining-count");
const deferredCount = document.getElementById("deferred-count");
const deferredPill = document.getElementById("deferred-pill");

const deferButton = document.getElementById("defer-button");
const saveGameButton = document.getElementById("save-game-button");

const loadGameButton = document.getElementById("load-game-button");

const loadGameInput = document.getElementById("load-game-input");
const resetButton = document.getElementById("reset-button");

// =========================================
// Helpers
// =========================================

function matchupKey(a, b) {
  return [a.id, b.id].sort().join("|||");
}

function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;

    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, seed) {
  const random = seededRandom(seed);

  // Fisher-Yates shuffle.
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function createMatchups(seed) {
  const pairs = [];

  for (let i = 0; i < POKEMON.length; i++) {
    for (let j = i + 1; j < POKEMON.length; j++) {
      pairs.push([POKEMON[i].id, POKEMON[j].id]);
    }
  }

  return shuffle(pairs, seed);
}

function getPokemon(id) {
  return POKEMON.find((pokemon) => pokemon.id === id);
}

// =========================================
// Artwork
// =========================================

const artworkCache = new Map();

async function getPokemonArtwork(pokemon) {
  // Return cached artwork if we've already
  // looked this Pokémon up.
  if (artworkCache.has(pokemon.apiName)) {
    return artworkCache.get(pokemon.apiName);
  }

  try {
    const response = await fetch(API_URL + pokemon.apiName);

    if (!response.ok) {
      throw new Error(`PokéAPI could not find "${pokemon.apiName}"`);
    }

    const data = await response.json();

    const artwork = data.sprites.other["official-artwork"].front_default;

    // Cache the result so we don't request it again.
    artworkCache.set(pokemon.apiName, artwork);

    return artwork;
  } catch (error) {
    console.error("Could not load artwork:", pokemon.displayName, error);

    return "";
  }
}

async function displayPokemon(pokemon, imageElement, nameElement) {
  nameElement.textContent = pokemon.displayName;

  imageElement.alt = pokemon.displayName;
  imageElement.src = "";
  imageElement.classList.remove("loaded");

  // Find the loading indicator inside this Pokémon card.
  const container = imageElement.closest(".pokemon-image-container");
  const loadingElement = container.querySelector(".loading");

  loadingElement.style.display = "block";

  const artwork = await getPokemonArtwork(pokemon);

  if (!artwork) {
    loadingElement.textContent = "Image unavailable";
    return;
  }

  imageElement.onload = () => {
    imageElement.classList.add("loaded");
    loadingElement.style.display = "none";
  };

  imageElement.onerror = () => {
    loadingElement.textContent = "Image unavailable";
  };

  imageElement.src = artwork;
}

// =========================================
// Tournament
// =========================================

function createTournament() {
  isProcessingChoice = false;
  // Generate a random seed for this tournament.
  tournamentSeed = crypto.getRandomValues(new Uint32Array(1))[0];

  matchups = createMatchups(tournamentSeed);

  currentIndex = 0;
  deferred = [];
  results = {};

  wins = {};
  losses = {};

  for (const pokemon of POKEMON) {
    wins[pokemon.id] = 0;
    losses[pokemon.id] = 0;
  }

  deferButton.textContent = "Too close to call";
  deferButton.disabled = false;

  showCurrentMatchup();
}

async function showCurrentMatchup() {
  // Skip any already-resolved matchups.
  while (
    currentIndex < matchups.length &&
    results[
      matchupKey(
        getPokemon(matchups[currentIndex][0]),
        getPokemon(matchups[currentIndex][1])
      )
    ]
  ) {
    currentIndex++;
  }

  // Normal matchups are finished.
  if (currentIndex >= matchups.length) {
    resolveDeferred();
    return;
  }

  const [idA, idB] = matchups[currentIndex];

  const a = getPokemon(idA);
  const b = getPokemon(idB);

  if (!a || !b) {
    console.error("Could not find Pokémon:", idA, idB);

    return;
  }

  matchupNumber.textContent = `Matchup ${currentIndex + 1} / ${
    matchups.length
  }`;

  updateProgress();

  deferButton.textContent = "Too close to call";
  deferButton.disabled = false;

  await Promise.all([
    displayPokemon(a, imageA, nameA),
    displayPokemon(b, imageB, nameB),
  ]);
}

// =========================================
// Choosing a Pokémon
// =========================================

function choosePokemon(winner) {
  if (isProcessingChoice) {
    return;
  }

  isProcessingChoice = true;

  const [idA, idB] = matchups[currentIndex];

  const a = getPokemon(idA);
  const b = getPokemon(idB);

  if (!a || !b) {
    console.error("Could not find matchup Pokémon:", idA, idB);

    isProcessingChoice = false;
    return;
  }

  const loser = winner.id === a.id ? b : a;

  const key = matchupKey(a, b);

  wins[winner.id]++;
  losses[loser.id]++;

  results[key] = {
    winner: winner.id,
    loser: loser.id,
  };

  currentIndex++;

  saveProgress();

  showCurrentMatchup().finally(() => {
    isProcessingChoice = false;
  });
}

// =========================================
// Defer matchup
// =========================================

function deferMatchup() {
  if (isProcessingChoice) {
    return;
  }

  isProcessingChoice = true;

  const [idA, idB] = matchups[currentIndex];

  const a = getPokemon(idA);
  const b = getPokemon(idB);

  if (!a || !b) {
    console.error("Could not find matchup Pokémon:", idA, idB);

    isProcessingChoice = false;
    return;
  }

  const key = matchupKey(a, b);

  if (!deferred.includes(key)) {
    deferred.push(key);
  }

  currentIndex++;

  saveProgress();

  showCurrentMatchup().finally(() => {
    isProcessingChoice = false;
  });
}

// =========================================
// Deferred matchups
// =========================================

async function resolveDeferred() {
  if (deferred.length === 0) {
    showResults();
    return;
  }

  // Find the next unresolved deferred matchup.
  const key = deferred.find((key) => !results[key]);

  if (!key) {
    showResults();
    return;
  }

  const [idA, idB] = key.split("|||");

  const a = getPokemon(idA);
  const b = getPokemon(idB);

  if (!a || !b) {
    console.error("Could not find deferred Pokémon:", idA, idB);

    showResults();
    return;
  }

  await Promise.all([
    displayPokemon(a, imageA, nameA),
    displayPokemon(b, imageB, nameB),
  ]);

  matchupNumber.textContent = "Deferred matchup";

  updateProgress();

  // Find the original matchup.
  currentIndex = matchups.findIndex(
    ([matchupA, matchupB]) =>
      matchupKey(getPokemon(matchupA), getPokemon(matchupB)) === key
  );

  const remaining = deferred.filter((key) => !results[key]);

  if (remaining.length === 1) {
    deferButton.textContent = "Final decision required";

    deferButton.disabled = true;
  } else {
    deferButton.textContent = "Too close to call";

    deferButton.disabled = false;
  }
}

// =========================================
// Progress
// =========================================

function updateProgress() {
  const completed = Object.keys(results).length;

  const total = matchups.length;

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  progressText.textContent = `${percentage}% complete`;

  progressBar.style.width = `${percentage}%`;

  remainingCount.textContent = total - completed;

  deferredCount.textContent = deferred.length;

  deferredPill.textContent = deferred.length;
}

// =========================================
// Results
// =========================================

function showResults() {
  const ranking = [...POKEMON].sort((a, b) => wins[b.id] - wins[a.id]);

  const winner = ranking[0];

  document.querySelector(".battle-area").innerHTML = `
    <div style="
      grid-column: 1 / -1;
      text-align: center;
      padding: 50px 20px;
    ">
      <div style="font-size: 60px;">🏆</div>

      <h2 style="
        font-size: 32px;
        margin: 16px 0;
      ">
        Your favorite Pokémon is...
      </h2>

      <h3 style="
        font-size: 40px;
        margin: 0;
      ">
        ${winner.displayName}
      </h3>

      <p style="color: #777786;">
        ${wins[winner.id]} wins
      </p>
    </div>
  `;

  document.querySelector(".actions").innerHTML = `
    <button
      class="button button-secondary"
      onclick="location.reload()"
    >
      Start Again
    </button>
  `;
}

function rebuildStats() {
  wins = {};
  losses = {};

  for (const pokemon of POKEMON) {
    wins[pokemon.id] = 0;
    losses[pokemon.id] = 0;
  }

  for (const result of Object.values(results)) {
    if (
      wins[result.winner] === undefined ||
      losses[result.loser] === undefined
    ) {
      continue;
    }

    wins[result.winner]++;
    losses[result.loser]++;
  }
}

// =========================================
// Save / Load
// =========================================

function getSaveData() {
  return {
    version: 2,
    pokemonListVersion: POKEMON_LIST_VERSION,

    seed: tournamentSeed,

    position: currentIndex,

    deferred,

    results,
  };
}

function saveProgress() {
  const data = getSaveData();

  localStorage.setItem("pokemon-favorite-tournament", JSON.stringify(data));
}

function saveGameFile() {
  const data = getSaveData();

  const saveText = JSON.stringify(data, null, 2);

  const blob = new Blob([saveText], {
    type: "text/plain",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = "pokemon-favorite-tournament.txt";

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

async function loadGameFile(file) {
  try {
    const text = await file.text();

    const data = JSON.parse(text);

    // Validate the save format.
    if (
      !data ||
      data.version !== 2 ||
      data.pokemonListVersion !== POKEMON_LIST_VERSION ||
      typeof data.seed !== "number" ||
      typeof data.position !== "number" ||
      !Array.isArray(data.deferred) ||
      typeof data.results !== "object" ||
      data.results === null
    ) {
      throw new Error("Invalid or incompatible save file.");
    }

    tournamentSeed = data.seed;

    matchups = createMatchups(tournamentSeed);

    currentIndex = data.position;

    deferred = data.deferred;

    results = data.results;

    rebuildStats();

    saveProgress();

    alert("Game loaded successfully!");

    location.reload();
  } catch (error) {
    console.error("Could not load save file:", error);

    alert(
      "Sorry, that file could not be loaded. " +
        "Make sure it is a Pokémon Favorites save file."
    );
  }
}

function loadProgress() {
  const saved = localStorage.getItem("pokemon-favorite-tournament");

  if (!saved) {
    createTournament();
    return;
  }

  try {
    const data = JSON.parse(saved);

    // Old save format.
    if (
      !data ||
      data.version !== 2 ||
      data.pokemonListVersion !== POKEMON_LIST_VERSION ||
      typeof data.seed !== "number" ||
      typeof data.position !== "number" ||
      !Array.isArray(data.deferred) ||
      typeof data.results !== "object" ||
      data.results === null
    ) {
      console.warn("Old save format detected. Starting a new tournament.");

      localStorage.removeItem("pokemon-favorite-tournament");

      createTournament();

      return;
    }

    tournamentSeed = data.seed;

    matchups = createMatchups(tournamentSeed);

    currentIndex = data.position;

    deferred = data.deferred;

    results = data.results;

    rebuildStats();

    showCurrentMatchup();
  } catch (error) {
    console.error("Could not load saved tournament:", error);

    localStorage.removeItem("pokemon-favorite-tournament");

    createTournament();
  }
}

// =========================================
// Events
// =========================================

pokemonA.addEventListener("click", () => {
  const [idA] = matchups[currentIndex];

  const pokemon = getPokemon(idA);

  if (pokemon) {
    choosePokemon(pokemon);
  }
});

pokemonB.addEventListener("click", () => {
  const [, idB] = matchups[currentIndex];

  const pokemon = getPokemon(idB);

  if (pokemon) {
    choosePokemon(pokemon);
  }
});

deferButton.addEventListener("click", deferMatchup);

saveGameButton.addEventListener("click", () => {
  saveGameFile();
});

loadGameButton.addEventListener("click", () => {
  loadGameInput.click();
});

loadGameInput.addEventListener("change", async () => {
  const file = loadGameInput.files[0];

  if (!file) {
    return;
  }

  await loadGameFile(file);

  // Allow the same file to be selected again later.
  loadGameInput.value = "";
});

resetButton.addEventListener("click", () => {
  const confirmed = confirm(
    "Reset your tournament? All progress will be lost."
  );

  if (!confirmed) {
    return;
  }

  localStorage.removeItem("pokemon-favorite-tournament");

  location.reload();
});

// =========================================
// Start the tournament
// =========================================

loadProgress();
