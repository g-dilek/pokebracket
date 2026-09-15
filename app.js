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
const saveButton = document.getElementById("save-button");
const resetButton = document.getElementById("reset-button");

// =========================================
// Helpers
// =========================================

function matchupKey(a, b) {
  return [a.id, b.id].sort().join("|||");
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function createMatchups() {
  const pairs = [];

  for (let i = 0; i < POKEMON.length; i++) {
    for (let j = i + 1; j < POKEMON.length; j++) {
      pairs.push([POKEMON[i], POKEMON[j]]);
    }
  }

  return shuffle(pairs);
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

  const artwork = await getPokemonArtwork(pokemon);

  if (!artwork) {
    return;
  }

  imageElement.onload = () => {
    imageElement.classList.add("loaded");
  };

  imageElement.src = artwork;
}

// =========================================
// Tournament
// =========================================

function createTournament() {
  matchups = createMatchups();

  currentIndex = 0;
  deferred = [];
  results = {};

  wins = {};
  losses = {};

  for (const pokemon of POKEMON) {
    wins[pokemon.id] = 0;
    losses[pokemon.id] = 0;
  }

  showCurrentMatchup();
}

async function showCurrentMatchup() {
  // Skip any already-resolved matchups.
  while (
    currentIndex < matchups.length &&
    results[matchupKey(...matchups[currentIndex])]
  ) {
    currentIndex++;
  }

  // Normal matchups are finished.
  if (currentIndex >= matchups.length) {
    resolveDeferred();
    return;
  }

  const [a, b] = matchups[currentIndex];

  matchupNumber.textContent = `Matchup ${currentIndex + 1} / ${
    matchups.length
  }`;

  updateProgress();

  await Promise.all([
    displayPokemon(a, imageA, nameA),
    displayPokemon(b, imageB, nameB),
  ]);
}

// =========================================
// Choosing a Pokémon
// =========================================

function choosePokemon(winner) {
  const [a, b] = matchups[currentIndex];

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

  showCurrentMatchup();
}

// =========================================
// Defer matchup
// =========================================

function deferMatchup() {
  const [a, b] = matchups[currentIndex];

  const key = matchupKey(a, b);

  if (!deferred.includes(key)) {
    deferred.push(key);
  }

  currentIndex++;

  saveProgress();

  showCurrentMatchup();
}

// =========================================
// Deferred matchups
// =========================================

function resolveDeferred() {
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

  const a = POKEMON.find((pokemon) => pokemon.id === idA);

  const b = POKEMON.find((pokemon) => pokemon.id === idB);

  if (!a || !b) {
    console.error("Could not find deferred Pokémon:", idA, idB);

    showResults();
    return;
  }

  // Display deferred matchup.
  displayPokemon(a, imageA, nameA);
  displayPokemon(b, imageB, nameB);

  matchupNumber.textContent = "Deferred matchup";

  updateProgress();

  // Find the original matchup so the
  // existing choosePokemon() logic can
  // resolve it.
  currentIndex = matchups.findIndex((pair) => matchupKey(...pair) === key);

  // If this is the last deferred matchup,
  // a decision is mandatory.
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

// =========================================
// Save / Load
// =========================================

function saveProgress() {
  const data = {
    matchups,
    currentIndex,
    deferred,
    wins,
    losses,
    results,
  };

  localStorage.setItem("pokemon-favorite-tournament", JSON.stringify(data));
}

function loadProgress() {
  const saved = localStorage.getItem("pokemon-favorite-tournament");

  if (!saved) {
    createTournament();
    return;
  }

  try {
    const data = JSON.parse(saved);

    matchups = data.matchups;
    currentIndex = data.currentIndex;
    deferred = data.deferred;
    wins = data.wins;
    losses = data.losses;
    results = data.results;

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
  const [a] = matchups[currentIndex];

  choosePokemon(a);
});

pokemonB.addEventListener("click", () => {
  const [, b] = matchups[currentIndex];

  choosePokemon(b);
});

deferButton.addEventListener("click", deferMatchup);

saveButton.addEventListener("click", () => {
  saveProgress();

  alert("Progress saved!");
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
