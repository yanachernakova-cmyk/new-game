const STATE = {
  START: "start",
  PLAYING: "playing",
  END: "end",
};

const BEST_TIME_KEY = "cat-vs-cursor-best";
const MAX_TIME = 30;
const GIFTS = [
  { id: "fish", name: "Fish Decoy", duration: 3 },
  { id: "slow", name: "Slow Time", duration: 4 },
  { id: "scare", name: "Scare Clap", duration: 2 },
];
const FORTUNES = [
  "A calm week is coming. Protect your mornings.",
  "Your next idea will work on the first try. Surprise.",
  "Coffee tastes better after a small win like this.",
  "Stop doubting. You’re already doing the thing.",
  "Today: less scrolling, more building.",
  "A message you send today will open a door.",
  "Your consistency is louder than your mood.",
  "You will meet a useful person by accident.",
  "Small steps. Big proof.",
  "Your future self is grateful for this exact effort.",
  "Do the simple version first. Glow-up later.",
  "You’re closer than you think.",
  "A tiny routine will save you hours.",
  "Make it pretty. Then make it fast.",
  "Your work will be noticed at the right time.",
  "You don’t need permission. Start.",
  "A new opportunity arrives when you share your work.",
  "Your taste is your superpower. Trust it.",
  "One brave ask will change the week.",
  "You are building momentum. Keep going.",
];

const bestTimeEls = document.querySelectorAll("[data-best-time]");
const timeEl = document.querySelector("[data-time]");
const speedEl = document.querySelector("[data-speed]");
const messageEl = document.querySelector("[data-message]");
const arena = document.querySelector(".arena");
const hud = document.querySelector(".hud");
const catEl = document.querySelector("[data-cat]");
const cursorEl = document.querySelector("[data-cursor]");
const fishEl = document.querySelector("[data-fish]");
const giftEl = document.querySelector("[data-gift]");
const giftSlots = document.querySelectorAll("[data-gift-slot]");
const toastEl = document.querySelector("[data-toast]");
const startOverlay = document.querySelector('[data-overlay="start"]');
const endOverlay = document.querySelector('[data-overlay="end"]');
const endLose = document.querySelector('[data-end="lose"]');
const endWin = document.querySelector('[data-end="win"]');
const fortuneEl = document.querySelector("[data-fortune]");
const cookieButton = document.querySelector("[data-cookie]");
const restartButton = document.querySelector("[data-restart]");

const state = {
  current: STATE.START,
  bestTime: 0,
  time: 0,
  speed: 1,
  baseSpeed: 280,
  nextLevelAt: 10,
  nextGiftAt: 0,
  giftsSpawned: 0,
  lastFrame: 0,
  isRunning: false,
  endMode: null,
  pendingFortune: "",
  catPos: { x: 0, y: 0 },
  catVel: { x: 0, y: 0 },
  cursorPos: { x: 0, y: 0 },
  fishPos: { x: 0, y: 0 },
  giftPos: { x: 0, y: 0 },
  inventory: [null, null],
  giftPickup: null,
  effects: {
    fishUntil: 0,
    slowUntil: 0,
    scareUntil: 0,
  },
  toastTimeout: null,
};

const loadBestTime = () => {
  const value = Number(localStorage.getItem(BEST_TIME_KEY));
  if (!Number.isNaN(value)) {
    state.bestTime = Math.min(value, MAX_TIME);
  }
};

const saveBestTime = (value) => {
  state.bestTime = value;
  localStorage.setItem(BEST_TIME_KEY, String(value));
};

const renderBestTime = () => {
  const label = `${Math.min(state.bestTime, MAX_TIME).toFixed(1)}s`;
  bestTimeEls.forEach((el) => {
    el.textContent = label;
  });
};

const showScreen = (next) => {
  state.current = next;
  document.body.classList.toggle("is-playing", next === STATE.PLAYING);
  if (startOverlay) startOverlay.hidden = next !== STATE.START;
  if (endOverlay) endOverlay.hidden = next !== STATE.END;
  if (hud) hud.hidden = next !== STATE.PLAYING;
  if (catEl) catEl.hidden = next !== STATE.PLAYING;
  if (cursorEl) cursorEl.hidden = next !== STATE.PLAYING;
  if (fishEl) fishEl.hidden = true;
  if (giftEl) {
    giftEl.hidden = next !== STATE.PLAYING || !state.giftPickup;
  }
  if (toastEl) toastEl.classList.remove("toast--show");
  if (endLose) endLose.hidden = !(next === STATE.END && state.endMode === "lose");
  if (endWin) endWin.hidden = !(next === STATE.END && state.endMode === "win");
};

const updateHud = () => {
  timeEl.textContent = state.time.toFixed(1);
  speedEl.textContent = state.speed;
};

const updateGiftHud = () => {
  giftSlots.forEach((slot, index) => {
    const gift = state.inventory[index];
    slot.textContent = gift ? gift.name : "Empty";
  });
};

const showToast = (message) => {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("toast--show");
  clearTimeout(state.toastTimeout);
  state.toastTimeout = window.setTimeout(() => {
    toastEl.classList.remove("toast--show");
  }, 1200);
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const setElementPosition = (el, pos) => {
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
};

const getArenaRect = () => arena.getBoundingClientRect();

const updateCursorPosition = (event) => {
  const rect = getArenaRect();
  state.cursorPos.x = clamp(event.clientX - rect.left, 0, rect.width);
  state.cursorPos.y = clamp(event.clientY - rect.top, 0, rect.height);
  setElementPosition(cursorEl, state.cursorPos);
};

const randomizeCat = () => {
  const rect = getArenaRect();
  state.catPos.x = Math.random() * rect.width;
  state.catPos.y = Math.random() * rect.height;
  state.catVel.x = 0;
  state.catVel.y = 0;
  setElementPosition(catEl, state.catPos);
};

const randomizeFish = () => {
  const rect = getArenaRect();
  state.fishPos.x = Math.random() * rect.width;
  state.fishPos.y = Math.random() * rect.height;
  setElementPosition(fishEl, state.fishPos);
};

const grantGift = () => {
  const gift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
  state.giftPickup = gift;
  const rect = getArenaRect();
  state.giftPos.x = Math.random() * rect.width;
  state.giftPos.y = Math.random() * rect.height;
  if (giftEl) {
    setElementPosition(giftEl, state.giftPos);
    giftEl.hidden = false;
  }
};

const useGift = (slotIndex) => {
  const gift = state.inventory[slotIndex];
  if (!gift) return;
  if (gift.id === "fish") {
    state.effects.fishUntil = state.time + gift.duration;
    fishEl.hidden = false;
    randomizeFish();
  }
  if (gift.id === "slow") {
    state.effects.slowUntil = state.time + gift.duration;
  }
  if (gift.id === "scare") {
    state.effects.scareUntil = state.time + gift.duration;
  }
  state.inventory[slotIndex] = null;
  updateGiftHud();
  showToast(`Used: ${gift.name}`);
};

const updateEffects = () => {
  if (state.effects.fishUntil && state.time >= state.effects.fishUntil) {
    state.effects.fishUntil = 0;
    fishEl.hidden = true;
  }
  if (state.effects.slowUntil && state.time >= state.effects.slowUntil) {
    state.effects.slowUntil = 0;
  }
  if (state.effects.scareUntil && state.time >= state.effects.scareUntil) {
    state.effects.scareUntil = 0;
  }
};

const tryPickupGift = () => {
  if (!state.giftPickup || giftEl.hidden) return;
  const emptyIndex = state.inventory.indexOf(null);
  if (emptyIndex === -1) return;
  const distance = Math.hypot(
    state.cursorPos.x - state.giftPos.x,
    state.cursorPos.y - state.giftPos.y
  );
  if (distance < 20) {
    state.inventory[emptyIndex] = state.giftPickup;
    state.giftPickup = null;
    giftEl.hidden = true;
    updateGiftHud();
    showToast(`Gift received: ${state.inventory[emptyIndex].name}`);
  }
};

const step = (time) => {
  if (!state.isRunning) return;
  const dt = state.lastFrame ? Math.min(0.05, (time - state.lastFrame) / 1000) : 0;
  state.lastFrame = time;

  state.time = Math.min(30, state.time + dt);

  if (state.time >= state.nextLevelAt && state.nextLevelAt <= 50) {
    state.speed = Math.min(6, 1 + Math.floor(state.time / 10));
    state.nextLevelAt += 10;
  }
  if (state.time >= state.nextGiftAt && state.nextGiftAt <= 30) {
    if (state.giftsSpawned < 3) {
      grantGift();
      state.giftsSpawned += 1;
      state.nextGiftAt = state.time + (Math.random() * 6 + 4);
    }
  }
  updateHud();
  updateEffects();
  tryPickupGift();

  const rect = getArenaRect();
  const target =
    state.effects.fishUntil > 0 ? state.fishPos : state.cursorPos;
  const dx = target.x - state.catPos.x;
  const dy = target.y - state.catPos.y;
  const distance = Math.hypot(dx, dy) || 1;
  let dirX = dx / distance;
  let dirY = dy / distance;
  if (state.effects.scareUntil > 0) {
    dirX *= -1;
    dirY *= -1;
  }

  const slowMultiplier = state.effects.slowUntil > 0 ? 0.5 : 1;
  const catSpeed =
    (state.baseSpeed + (state.speed - 1) * 35) * slowMultiplier;
  const accel = 6;
  const targetVelX = dirX * catSpeed;
  const targetVelY = dirY * catSpeed;
  state.catVel.x += (targetVelX - state.catVel.x) * accel * dt;
  state.catVel.y += (targetVelY - state.catVel.y) * accel * dt;

  state.catPos.x += state.catVel.x * dt;
  state.catPos.y += state.catVel.y * dt;
  state.catPos.x = clamp(state.catPos.x, 0, rect.width);
  state.catPos.y = clamp(state.catPos.y, 0, rect.height);
  setElementPosition(catEl, state.catPos);

  const collisionDistance = Math.hypot(
    state.cursorPos.x - state.catPos.x,
    state.cursorPos.y - state.catPos.y
  );
  if (collisionDistance < 28) {
    endGame(
      `You survived only ${state.time.toFixed(
        1
      )} seconds. Try to reach 30 seconds to win the game and receive the gift.`
    );
    return;
  }

  if (state.time >= 30) {
    winGame();
    return;
  }

  requestAnimationFrame(step);
};

const startGame = () => {
  state.speed = 1;
  state.baseSpeed = 280;
  state.nextLevelAt = 10;
  state.nextGiftAt = Math.random() * 6 + 4;
  state.giftsSpawned = 0;
  state.inventory = [null, null];
  state.effects = { fishUntil: 0, slowUntil: 0, scareUntil: 0 };
  state.endMode = null;
  state.pendingFortune = "";
  state.giftPickup = null;
  showScreen(STATE.PLAYING);
  state.time = 0;
  state.lastFrame = 0;
  state.isRunning = true;
  updateHud();
  updateGiftHud();
  fishEl.hidden = true;
  if (giftEl) giftEl.hidden = true;
  if (fortuneEl) fortuneEl.hidden = true;
  if (restartButton) restartButton.hidden = true;
  const rect = getArenaRect();
  state.cursorPos.x = rect.width * 0.5;
  state.cursorPos.y = rect.height * 0.5;
  setElementPosition(cursorEl, state.cursorPos);
  randomizeCat();
  requestAnimationFrame(step);
};

const endGame = (message) => {
  state.isRunning = false;
  state.endMode = "lose";
  if (state.time > state.bestTime) {
    saveBestTime(state.time);
  }
  renderBestTime();
  messageEl.textContent = message || "Game over";
  if (toastEl) {
    toastEl.classList.remove("toast--show");
  }
  if (fishEl) {
    fishEl.hidden = true;
  }
  if (giftEl) {
    giftEl.hidden = true;
  }
  showScreen(STATE.END);
};

const winGame = () => {
  state.isRunning = false;
  state.endMode = "win";
  state.pendingFortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  if (fortuneEl) fortuneEl.hidden = true;
  if (restartButton) restartButton.hidden = true;
  if (toastEl) {
    toastEl.classList.remove("toast--show");
  }
  if (fishEl) {
    fishEl.hidden = true;
  }
  if (giftEl) {
    giftEl.hidden = true;
  }
  showScreen(STATE.END);
};

const handleAction = (action) => {
  if (action === "start" || action === "restart") {
    startGame();
  }
  if (action === "mute") {
    // Placeholder toggle for future audio.
  }
};

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  handleAction(button.dataset.action);
});

if (cookieButton) {
  cookieButton.addEventListener("click", () => {
    if (state.endMode !== "win") return;
    if (!fortuneEl) return;
    fortuneEl.textContent = `Your fortune cookie:\n${state.pendingFortune}`;
    fortuneEl.hidden = false;
    if (restartButton) restartButton.hidden = false;
  });
}

document.addEventListener("keydown", (event) => {
  if (state.current !== STATE.PLAYING) return;
  if (event.key === "1") useGift(0);
  if (event.key === "2") useGift(1);
});

arena.addEventListener("mousemove", (event) => {
  if (state.current !== STATE.PLAYING) return;
  updateCursorPosition(event);
});

arena.addEventListener("click", () => {
  if (state.current !== STATE.PLAYING) return;
  if (state.inventory[0]) {
    useGift(0);
  } else if (state.inventory[1]) {
    useGift(1);
  }
});

loadBestTime();
renderBestTime();
showScreen(STATE.START);
