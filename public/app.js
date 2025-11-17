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
  showGame();
});

socket.on('trumpCardSet', (data) => {
  // Handle trump card set
  updateGameDisplay();
});

socket.on('trumpRevealed', (data) => {
  gameState.trumpSuit = data.trumpSuit;
  showNotification(`Trump Suit Revealed: ${data.trumpSuit}`, 'info');
  updateGameDisplay();
});

socket.on('cardPlayed', (data) => {
  gameState.cardsInPlay = data.cardsInPlay;
  gameState.leadingSuit = data.leadingSuit;
  updateGameDisplay();
});

socket.on('nextTurn', (data) => {
  gameState.currentPlayerIndex = data.currentPlayerIndex;
  updateGameDisplay();
});

socket.on('roundComplete', (data) => {
  gameState.scores = data.scores;
  const winnerName = gameState.players[data.winner].name;
  showNotification(`${winnerName} wins the round! +${data.points} points`, 'success');
  updateGameDisplay();
});

socket.on('nextRound', (data) => {
  gameState.currentRound = data.currentRound;
  gameState.currentPlayerIndex = data.currentPlayerIndex;
  gameState.cardsInPlay = [];
  gameState.leadingSuit = null;
  updateGameDisplay();
});

socket.on('gameOver', (data) => {
  const winnerName = gameState.players[data.winner].name;
  showNotification(`🎉 ${winnerName} wins the game! 🎉`, 'success');
  setTimeout(() => showHome(), 5000);
});

socket.on('playerLeft', (data) => {
  gameState.players = data.players;
  updatePlayersList();
});

socket.on('error', (data) => {
  alert(data.message);
});

// Show game screen
function showGame() {
  homeScreen.style.display = 'none';
  lobbyScreen.style.display = 'none';
  gameScreen.style.display = 'block';

  renderMyHand();
  updateGameDisplay();
}

// Render player's hand
function renderMyHand() {
  const handDiv = document.getElementById('my-hand');
  handDiv.innerHTML = '';

  gameState.myHand.forEach((card, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    // Check if trump card
    if (gameState.trumpCard && gameState.trumpCard.card === card) {
      cardDiv.classList.add('trump-card');
    }

    // Extract rank and suit
    const [rank, , suit] = card.split(' ');
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

  // Remove from hand locally
  gameState.myHand = gameState.myHand.filter(c => c !== gameState.selectedCard);
  gameState.selectedCard = null;
  renderMyHand();
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
  gameState.selectedCard = null;
  renderMyHand();
  updateGameDisplay();
});

// Pass trump
document.getElementById('pass-trump-btn').addEventListener('click', () => {
  socket.emit('passTrump', {
    roomCode: gameState.roomCode
  });
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
  document.getElementById('scores-display').innerHTML = gameState.players
    .map((p, i) => `<span>${p.name}: ${gameState.scores[i]}</span>`)
    .join(' | ');

  // Update center table
  const centerDiv = document.getElementById('center-table');
  centerDiv.innerHTML = '';
  gameState.cardsInPlay.forEach(({ playerId, card }) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'played-card';
    const [rank, , suit] = card.split(' ');
    const suitColor = (suit === '♥' || suit === '♦') ? 'red' : 'black';
    cardDiv.innerHTML = `
      <div class="card-content" style="color: ${suitColor}">
        <div class="card-suit-large">${suit}</div>
        <div class="card-rank-large">${rank}</div>
      </div>
      <div class="player-label">${gameState.players[playerId].name}</div>
    `;
    centerDiv.appendChild(cardDiv);
  });

  // Show/hide trump selection buttons
  if (gameState.phase === 'trump-selection' && isMyTurn && !gameState.trumpCard) {
    document.getElementById('trump-selection-btns').style.display = 'block';
    document.getElementById('play-card-btn').style.display = 'none';
  } else {
    document.getElementById('trump-selection-btns').style.display = 'none';
    document.getElementById('play-card-btn').style.display = isMyTurn ? 'block' : 'none';
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
