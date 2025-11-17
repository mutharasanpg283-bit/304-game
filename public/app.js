// Socket.io client connection
const socket = io();

// Game state
let gameState = {
  roomCode: null,
  myPlayerId: null,
  myName: '',
  phase: 'home',
  players: [],
  myHand: [],
  cardsInPlay: [],
  leadingSuit: null,
  trumpCard: null,
  trumpSuit: null,
  currentPlayerIndex: 0,
  currentRound: 1,
  scores: [0, 0, 0, 0],
  selectedCard: null
};

// DOM Elements
const homeScreen = document.getElementById('home-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const roomCodeInput = document.getElementById('room-code-input');
const playerNameInput = document.getElementById('player-name-input');
const roomCodeDisplay = document.getElementById('room-code-display');
const playersListDiv = document.getElementById('players-list');
const readyBtn = document.getElementById('ready-btn');
const startGameBtn = document.getElementById('start-game-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

// Create game
createGameBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim() || 'Player 1';
  gameState.myName = playerName;

  socket.emit('createGame', playerName, (response) => {
    if (response.success) {
      gameState.roomCode = response.roomCode;
      gameState.myPlayerId = response.playerId;
      showLobby();
    }
  });
});

// Join game
joinGameBtn.addEventListener('click', () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  const playerName = playerNameInput.value.trim() || 'Player';

  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }

  gameState.myName = playerName;

  socket.emit('joinGame', { roomCode, playerName }, (response) => {
    if (response.success) {
      gameState.roomCode = roomCode;
      gameState.myPlayerId = response.playerId;
      gameState.players = response.players;
      showLobby();
    } else {
      alert(response.error);
    }
  });
});

// Show lobby
function showLobby() {
  homeScreen.style.display = 'none';
  lobbyScreen.style.display = 'block';
  gameScreen.style.display = 'none';

  roomCodeDisplay.textContent = gameState.roomCode;
  updatePlayersList();

  // Show start button only for host
  if (gameState.myPlayerId === 0) {
    startGameBtn.style.display = 'block';
  } else {
    startGameBtn.style.display = 'none';
  }
}

// Update players list
function updatePlayersList() {
  playersListDiv.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-item';

    if (gameState.players[i]) {
      const player = gameState.players[i];
      const isMe = i === gameState.myPlayerId;

      playerDiv.innerHTML = `
        <div class="player-info">
          <div class="player-name">
            ${isMe ? '<strong>(You)</strong> ' : ''}${player.name}
          </div>
          ${player.ready ? '<span class="ready-badge">✓ Ready</span>' : ''}
        </div>
        ${isMe && !player.ready ? '<button class="edit-name-btn" onclick="editMyName()">Edit Name</button>' : ''}
      `;
    } else {
      playerDiv.innerHTML = '<div class="player-waiting">Waiting for player...</div>';
    }

    playersListDiv.appendChild(playerDiv);
  }
}

// Edit my name
window.editMyName = function() {
  const newName = prompt('Enter your name:', gameState.myName);
  if (newName && newName.trim()) {
    gameState.myName = newName.trim();
    socket.emit('updatePlayerName', {
      roomCode: gameState.roomCode,
      playerId: gameState.myPlayerId,
      newName: gameState.myName
    });
  }
};

// Ready button
readyBtn.addEventListener('click', () => {
  socket.emit('playerReady', {
    roomCode: gameState.roomCode,
    playerId: gameState.myPlayerId
  });
  readyBtn.disabled = true;
  readyBtn.textContent = 'Ready ✓';
});

// Start game
startGameBtn.addEventListener('click', () => {
  if (gameState.players.length !== 4) {
    alert('Need 4 players to start!');
    return;
  }

  const allReady = gameState.players.every(p => p.ready);
  if (!allReady) {
    alert('All players must be ready!');
    return;
  }

  socket.emit('startGame', gameState.roomCode);
});

// Leave room
leaveRoomBtn.addEventListener('click', () => {
  socket.emit('leaveGame');
  showHome();
});

// Show home
function showHome() {
  homeScreen.style.display = 'block';
  lobbyScreen.style.display = 'none';
  gameScreen.style.display = 'none';
  gameState = {
    roomCode: null,
    myPlayerId: null,
    myName: '',
    phase: 'home',
    players: [],
    myHand: [],
    cardsInPlay: [],
    leadingSuit: null,
    trumpCard: null,
    trumpSuit: null,
    currentPlayerIndex: 0,
    currentRound: 1,
    scores: [0, 0, 0, 0],
    selectedCard: null
  };
}

// Socket event listeners
socket.on('playerJoined', (data) => {
  gameState.players = data.players;
  updatePlayersList();
});

socket.on('playerUpdated', (data) => {
  gameState.players = data.players;
  updatePlayersList();
});

socket.on('playerReadyUpdate', (data) => {
  gameState.players = data.players;
  updatePlayersList();
});

socket.on('gameStarted', (data) => {
  gameState = { ...gameState, ...data.gameState };
  // Default to trump-selection phase at start of a new game until server or a player sets trump
  if (!gameState.phase) {
    gameState.phase = 'trump-selection';
    gameState.currentPlayerIndex = gameState.currentPlayerIndex ?? 0;
  }
  showGame();
  updateGameDisplay();
});

socket.on('trumpCardSet', (data) => {
  // Handle trump card set - store selection and allow reveal
  if (data && data.trumpCard) {
    // store the trump selection source but do not reveal the suit to everyone
    gameState.trumpCard = data.trumpCard;
  }
  // Mark that a trump was selected (suit hidden from others) so players know reveal can be requested later
  if (data && data.trumpSet) {
    gameState.trumpSelected = true;
  }
  // server sets the next game phase to playing
  gameState.phase = 'play';
  // update current player index if server provided it (setter should start)
  if (data && typeof data.currentPlayerIndex !== 'undefined') {
    gameState.currentPlayerIndex = data.currentPlayerIndex;
  }
  // If the server told us who selected trump, and it was this client, show a start message
  if (data && typeof data.playerId !== 'undefined' && data.playerId === gameState.myPlayerId) {
    showNotification('You selected trump — you start the round! Play your first card.', 'success');
  }
  updateGameDisplay();
});

socket.on('trumpPassed', (data) => {
  // Update current player index and notify clients
  gameState.currentPlayerIndex = data.currentPlayerIndex;
  showNotification(`Trump passed to ${gameState.players[data.currentPlayerIndex].name}`, 'info');
  updateGameDisplay();
});

socket.on('trumpRevealed', (data) => {
  gameState.trumpSuit = data.trumpSuit;
  showNotification(`Trump Suit Revealed: ${data.trumpSuit}`, 'info');
  // Show a textual overlay
  const trumpDisplay = document.getElementById('trump-display');
  if (gameState.trumpSuit) {
    trumpDisplay.textContent = `TRUMP: ${gameState.trumpSuit}`;
    trumpDisplay.style.display = 'block';
  } else {
    trumpDisplay.style.display = 'none';
  }
  // clear candidate suit once the server officially revealed the trump
  gameState.candidateTrumpSuit = null;
  // clear private reveal for the client(s) as the trump is now public
  gameState.privateTrumpSuit = null;
  // After revealing the trump, change phase to normal play
  gameState.phase = 'play';
  // No longer a candidate-only trump: it's public now
  gameState.trumpSelected = false;
  updateGameDisplay();
  playSFX('reveal');
});
socket.on('trumpRevealed', (data) => {
  // hide reveal availability once trump is officially revealed
  gameState.revealAvailable = false;
  updateGameDisplay();
});

socket.on('cardPlayed', (data) => {
  gameState.cardsInPlay = data.cardsInPlay;
  gameState.leadingSuit = data.leadingSuit;
  // If this client played the card, remove it from their hand now that server accepted it
  if (typeof data.playerId !== 'undefined' && data.playerId === gameState.myPlayerId) {
    gameState.myHand = gameState.myHand.filter(c => c !== data.card);
    // clear selection if it was the played card
    if (gameState.selectedCard === data.card) gameState.selectedCard = null;
    // Re-enable play button after server acknowledgement
    const playBtn = document.getElementById('play-card-btn');
    if (playBtn) playBtn.disabled = false;
  }
  playSFX('play');
  updateGameDisplay();
});

socket.on('nextTurn', (data) => {
  gameState.currentPlayerIndex = data.currentPlayerIndex;
  updateGameDisplay();
  // Reset reveal button availability when a new turn arrives
  gameState.revealAvailable = false;
});

// Server tells the player they can request a private reveal
socket.on('revealAvailable', (data) => {
  // Only the targeted player will receive this from server
  gameState.revealAvailable = data.canReveal;
  updateGameDisplay();
});

// Private reveal of the candidate trump suit - only to one player
socket.on('revealTrumpPrivate', (data) => {
  gameState.privateTrumpSuit = data.trumpSuit;
  showNotification(`Private: TRUMP is ${data.trumpSuit}`, 'info');
  playSFX('reveal');
  // small reveal animation
  const privateTr = document.getElementById('private-trump-display');
  if (privateTr) {
    privateTr.classList.add('reveal-animate');
    setTimeout(() => privateTr.classList.remove('reveal-animate'), 1200);
  }
  updateGameDisplay();
});

// Hide private trump display on next round or new phase
socket.on('nextRound', (data) => {
  gameState.privateTrumpSuit = null;
  const privateTr = document.getElementById('private-trump-display');
  if (privateTr) privateTr.style.display = 'none';
});

socket.on('roundComplete', (data) => {
  gameState.scores = data.scores;
  const winnerName = gameState.players[data.winner].name;
  showNotification(`${winnerName} wins the round! +${data.points} points`, 'success');
  // Animate center cards fade-out for clarity, then update display
  const center = document.getElementById('center-table');
  if (center) {
    Array.from(center.querySelectorAll('.played-card')).forEach(el => el.classList.add('fade-out'));
    // Animate trick to winner: clone cards and animate to winner's score slot
    const winnerSlot = document.getElementById(`score-player-${data.winner}`);
    if (winnerSlot) {
      Array.from(center.querySelectorAll('.played-card')).forEach((el) => {
        const rect = el.getBoundingClientRect();
        const clone = el.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.margin = '0';
        clone.style.zIndex = 9999;
        document.body.appendChild(clone);
        const targetRect = winnerSlot.getBoundingClientRect();
        requestAnimationFrame(() => {
          clone.style.transition = 'transform 0.9s ease, opacity 0.9s ease';
          const dx = targetRect.left + targetRect.width/2 - (rect.left + rect.width/2);
          const dy = targetRect.top + targetRect.height/2 - (rect.top + rect.height/2);
          clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.25)`;
          clone.style.opacity = '0.35';
          setTimeout(() => clone.remove(), 1000);
        });
      });
    }
  }
  playSFX('round');
  setTimeout(() => updateGameDisplay(), 900);
});

// Play error SFX when server emits error
socket.on('error', (data) => {
  playSFX('error');
  showNotification(data.message, 'error');
  // Re-enable play button so player can try again
  const playBtn = document.getElementById('play-card-btn');
  if (playBtn) playBtn.disabled = false;
});

socket.on('nextRound', (data) => {
  gameState.currentRound = data.currentRound;
  gameState.currentPlayerIndex = data.currentPlayerIndex;
  gameState.cardsInPlay = [];
  gameState.leadingSuit = null;
  updateGameDisplay();
});

socket.on('gameOver', (data) => {
  // Display end-screen with detailed scores
  const winnerName = gameState.players[data.winner].name;
  showNotification(`🎉 ${winnerName} wins the game! 🎉`, 'success');
  showEndScreen(data);
});

// Show end screen overlay with scores and winner
function showEndScreen(data) {
  const endScreen = document.getElementById('end-screen');
  const endScoresDiv = document.getElementById('end-scores');
  const heading = document.getElementById('end-heading');
  const winnerName = gameState.players[data.winner] ? gameState.players[data.winner].name : 'Winner';
  heading.textContent = `🎉 ${winnerName} wins the game! 🎉`;

  let scoresHtml = '';
  for (let i = 0; i < gameState.players.length; i++) {
    if (!gameState.players[i]) continue;
    scoresHtml += `<div>${gameState.players[i].name}: ${gameState.scores[i] || 0}</div>`;
  }
  endScoresDiv.innerHTML = scoresHtml;
  endScreen.style.display = 'flex';
}

document.getElementById('end-home-btn').addEventListener('click', () => {
  const endScreen = document.getElementById('end-screen');
  endScreen.style.display = 'none';
  showHome();
});

socket.on('playerLeft', (data) => {
  gameState.players = data.players;
  updatePlayersList();
});


// Show game screen
function showGame() {
  homeScreen.style.display = 'none';
  lobbyScreen.style.display = 'none';
  gameScreen.style.display = 'block';

  renderMyHand();
  updateGameDisplay();
}

// Simple WebAudio SFX helper
const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
function playSFX(type) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g);
  g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  if (type === 'play') { o.type='sine'; o.frequency.setValueAtTime(600, now); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.12, now+0.01); o.frequency.exponentialRampToValueAtTime(800, now+0.12); }
  if (type === 'error') { o.type='square'; o.frequency.setValueAtTime(220, now); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.2, now+0.01); o.frequency.exponentialRampToValueAtTime(120, now+0.12); }
  if (type === 'reveal') { o.type='triangle'; o.frequency.setValueAtTime(400, now); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.15, now+0.01); o.frequency.exponentialRampToValueAtTime(600, now+0.18); }
  if (type === 'round') { o.type='sine'; o.frequency.setValueAtTime(300, now); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.18, now+0.01); o.frequency.exponentialRampToValueAtTime(540, now+0.22); }
  o.start(now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  o.stop(now + 0.5);
}

// Render player's hand
function renderMyHand() {
  const handDiv = document.getElementById('my-hand');
  handDiv.innerHTML = '';
  // Sort hand by suit then rank for easier reading
  const suitOrder = ['♠','♥','♦','♣'];
  const rankOrder = ['J','9','A','10','K','Q','8','7'];
  const sortedHand = [...gameState.myHand].sort((a,b) => {
    const partsA = a.split(' ');
    const partsB = b.split(' ');
    const suitA = partsA[2];
    const suitB = partsB[2];
    if (suitA !== suitB) return suitOrder.indexOf(suitA) - suitOrder.indexOf(suitB);
    const rankA = partsA[0];
    const rankB = partsB[0];
    return rankOrder.indexOf(rankA) - rankOrder.indexOf(rankB);
  });

  const handCount = sortedHand.length;
  const containerWidth = handDiv.clientWidth || handDiv.offsetWidth || 800;
  const gap = 10; // matches CSS gap
  const maxCardWidth = 92;
  const minCardWidth = 64;
  let cardWidth = Math.floor((containerWidth - gap * Math.max(0, handCount - 1)) / Math.max(1, handCount));
  cardWidth = Math.min(maxCardWidth, Math.max(minCardWidth, cardWidth));

  sortedHand.forEach((card, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    // set dynamic size so hand fits in one row
    cardDiv.style.width = `${cardWidth}px`;
    cardDiv.style.height = `${Math.round(cardWidth * (128/92))}px`;

    // Check if trump card or trump suit
    if (gameState.trumpCard && gameState.trumpCard.card === card) {
      cardDiv.classList.add('trump-card');
    }
    // Extract rank and suit to check for highlighting
    const [rank, , suit] = card.split(' ');
    if (gameState.trumpSuit && suit === gameState.trumpSuit) {
      cardDiv.classList.add('trump-suit');
    }
    // Candidate highlight when current player has selected a candidate trump card
    if (gameState.candidateTrumpSuit && suit === gameState.candidateTrumpSuit) {
      cardDiv.classList.add('candidate-trump');
    }
    // Private reveal highlight (only shown to player who asked)
    if (gameState.privateTrumpSuit && suit === gameState.privateTrumpSuit) {
      cardDiv.classList.add('candidate-trump');
    }
    const suitColor = (suit === '♥' || suit === '♦') ? 'red' : 'black';

    cardDiv.innerHTML = `
      <div class="card-content" style="color: ${suitColor}">
        <div class="card-corner">${rank}<br>${suit}</div>
        <div class="card-center">
          <div class="card-suit">${suit}</div>
          <div class="card-rank">${rank}</div>
        </div>
        <div class="card-corner card-corner-bottom">${rank}<br>${suit}</div>
      </div>
    `;

    cardDiv.addEventListener('click', () => selectCard(card, cardDiv));
    handDiv.appendChild(cardDiv);
  });
}

// Render player slots (corner UI)
function renderPlayerSlots() {
  const slots = ['bottom-left', 'top-left', 'top-right', 'bottom-right'];
  const slotIds = ['player-slot-bottom-left', 'player-slot-top-left', 'player-slot-top-right', 'player-slot-bottom-right'];

  // Rotate slots to make sure current player is at bottom-left
  for (let i = 0; i < 4; i++) {
    const relative = (i - gameState.myPlayerId + 4) % 4;
    const slotName = slots[relative];
    const slotEl = document.getElementById(slotIds[relative]);
    if (!slotEl) continue;

    if (gameState.players[i]) {
      const p = gameState.players[i];
      slotEl.innerHTML = `
        <div class="player-name">${i === gameState.myPlayerId ? '<strong>(You)</strong> ' : ''}${p.name}</div>
        <div class="player-score">Points: ${gameState.scores[i] || 0}</div>
      `;
      slotEl.style.opacity = 1;
      // Highlight current player's slot border
      if (gameState.currentPlayerIndex === i) {
        slotEl.style.boxShadow = '0 0 12px rgba(255,255,0,0.8)';
      } else {
        slotEl.style.boxShadow = 'none';
      }
    } else {
      slotEl.innerHTML = `<div class="player-waiting">Waiting...</div>`;
      slotEl.style.opacity = 0.6;
      slotEl.style.boxShadow = 'none';
    }
  }
}

// Select card
function selectCard(card, cardElement) {
  // Remove previous selection
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));

  // Select new card
  gameState.selectedCard = card;
  cardElement.classList.add('selected');
}

// Play card button
document.getElementById('play-card-btn').addEventListener('click', () => {
  if (!gameState.selectedCard) {
    alert('Please select a card first!');
    return;
  }

  if (gameState.currentPlayerIndex !== gameState.myPlayerId) {
    alert('Not your turn!');
    return;
  }

  socket.emit('playCard', {
    roomCode: gameState.roomCode,
    playerId: gameState.myPlayerId,
    card: gameState.selectedCard
  });
  // Disable play button until server acknowledges the play
  const playBtn = document.getElementById('play-card-btn');
  if (playBtn) playBtn.disabled = true;
});

// Set trump card
document.getElementById('set-trump-btn').addEventListener('click', () => {
  if (!gameState.selectedCard) {
    alert('Please select a card first!');
    return;
  }

  socket.emit('setTrumpCard', {
    roomCode: gameState.roomCode,
    playerId: gameState.myPlayerId,
    card: gameState.selectedCard
  });

  gameState.trumpCard = { playerId: gameState.myPlayerId, card: gameState.selectedCard };
  // Candidate trump highlight is local to the player who selected it; we don't reveal suit to others
  const [r, , candidateSuit] = gameState.selectedCard.split(' ');
  gameState.candidateTrumpSuit = candidateSuit;
  showNotification(`Candidate Trump Suit: ${candidateSuit}`, 'info');
  gameState.selectedCard = null;
  renderMyHand();
  updateGameDisplay();
});

// Pass trump
document.getElementById('pass-trump-btn').addEventListener('click', () => {
  socket.emit('passTrump', {
    roomCode: gameState.roomCode
  });
  // Clear the current candidate highlight before server moves turn
  gameState.candidateTrumpSuit = null;
  updateGameDisplay();
});

// Reveal trump button (private reveal to the requesting player)
document.getElementById('reveal-trump-btn').addEventListener('click', () => {
  socket.emit('askRevealTrump', { roomCode: gameState.roomCode, playerId: gameState.myPlayerId });
  // Hide the button while waiting for server ack
  gameState.revealAvailable = false;
  updateGameDisplay();
});

// Update game display
function updateGameDisplay() {
  // Update round info
  document.getElementById('round-info').textContent = `Round ${gameState.currentRound}/8`;

  // Update turn info
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = gameState.currentPlayerIndex === gameState.myPlayerId;
  document.getElementById('turn-info').textContent = isMyTurn ? 
    'YOUR TURN' : `${currentPlayer.name}'s Turn`;

  // Update scores
  // Update scoreboard slots
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`score-player-${i}`);
    if (!slot) continue;
    if (gameState.players[i]) {
      const isMe = i === gameState.myPlayerId;
      slot.innerHTML = `<div>${isMe ? '<strong>(You)</strong> ' : ''}${gameState.players[i].name}</div><div style="opacity:0.9">Points: ${gameState.scores[i] || 0}</div>`;
      slot.classList.toggle('current', gameState.currentPlayerIndex === i);
    } else {
      slot.innerHTML = `<div>Waiting</div><div>Points: 0</div>`;
      slot.classList.remove('current');
    }
  }

  // Update center table (render as a horizontal row)
  const centerDiv = document.getElementById('center-table');
  centerDiv.innerHTML = '';
  centerDiv.classList.add('center-row');
  // Render cards in a row order by play sequence
  gameState.cardsInPlay.forEach(({ playerId, card }) => {
    // Render a full card element (same style as hand) for each played card
    const [rank, , suit] = card.split(' ');
    const suitColor = (suit === '♥' || suit === '♦') ? 'red' : 'black';
    const wrapper = document.createElement('div');

    const c = document.createElement('div');
    c.className = 'card played-center-card';
    c.innerHTML = `
      <div class="card-content" style="color: ${suitColor}">
        <div class="card-corner">${rank}<br>${suit}</div>
        <div class="card-center">
          <div class="card-suit">${suit}</div>
          <div class="card-rank">${rank}</div>
        </div>
        <div class="card-corner card-corner-bottom">${rank}<br>${suit}</div>
      </div>
    `;

    // player label below the card
    const label = document.createElement('div');
    label.className = 'player-label';
    label.textContent = gameState.players[playerId] ? gameState.players[playerId].name : '';

    wrapper.appendChild(c);
    wrapper.appendChild(label);

    // Use a simple row layout; add identifying class
    wrapper.classList.add('played-card');
    centerDiv.appendChild(wrapper);

    // Add entry animation
    wrapper.classList.add('played-animate');
    setTimeout(() => wrapper.classList.remove('played-animate'), 900);
  });

  // Show/hide trump selection buttons
  if (gameState.phase === 'trump-selection' && isMyTurn && !gameState.trumpSuit) {
    document.getElementById('trump-selection-btns').style.display = 'block';
    document.getElementById('play-card-btn').style.display = 'none';
    document.getElementById('turn-info').textContent = 'Choose trump or PASS';
  } else {
    document.getElementById('trump-selection-btns').style.display = 'none';
    document.getElementById('trump-selection-btns').style.display = 'none';
    // reveal button is displayed only to player who can't follow suit and if a trump exists but isn't revealed
    const showRevealBtn = isMyTurn && gameState.revealAvailable && gameState.trumpSelected && !gameState.trumpSuit;
    document.getElementById('reveal-trump-btn').style.display = showRevealBtn ? 'block' : 'none';
    // In play phase, only the current player sees play button
    document.getElementById('play-card-btn').style.display = isMyTurn ? 'block' : 'none';
  }

  // render player slots and highlight trump suit in the hand
  renderPlayerSlots();
  renderMyHand();

  // Display private trump (if this client asked and received reveal)
  const privateTr = document.getElementById('private-trump-display');
  const privateSuitSpan = document.getElementById('private-trump-suit');
  if (gameState.privateTrumpSuit) {
    privateSuitSpan.textContent = gameState.privateTrumpSuit;
    privateTr.style.display = 'block';
  } else {
    privateTr.style.display = 'none';
  }
}

// Show notification
function showNotification(message, type) {
  const notif = document.createElement('div');
  notif.className = `notification notification-${type}`;
  notif.textContent = message;
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.remove();
  }, 3000);
}

// Copy room code
document.getElementById('copy-code-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(gameState.roomCode);
  showNotification('Room code copied!', 'info');
});
