// Game Constants
const RANKS = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const SUITS = ['♥', '♣', '♠', '♦'];
const RANK_VALUES = { 'J': 7, '9': 6, 'A': 5, '10': 4, 'K': 3, 'Q': 2, '8': 1, '7': 0 };
const RANK_SCORES = { 'J': 3, '9': 2, 'A': 1, '10': 1, 'K': 1, 'Q': 1, '8': 0, '7': 0 };
const PLAYER_COLORS = {
    1: '#2196F3',
    2: '#F44336',
    3: '#FFEB3B',
    4: '#4CAF50'
};

// Game State
let gameState = {
    roomCode: null,
    isHost: false,
    myPlayerId: null,
    players: [
        { id: 1, name: 'Player 1', hand: [], score: 0, ready: false, connected: false, trumpCard: null },
        { id: 2, name: 'Player 2', hand: [], score: 0, ready: false, connected: false, trumpCard: null },
        { id: 3, name: 'Player 3', hand: [], score: 0, ready: false, connected: false, trumpCard: null },
        { id: 4, name: 'Player 4', hand: [], score: 0, ready: false, connected: false, trumpCard: null }
    ],
    currentPlayer: 0,
    roundStartPlayer: 0,
    playedCards: [null, null, null, null],
    trumpSuit: null,
    trumpRevealed: false,
    firstCardSuit: null,
    selectedCard: null,
    phase: 'welcome', // welcome, lobby, trump_selection, playing, round_end, game_end
    trumpSelectionPhase: true,
    trumpSelectionPassed: [false, false, false, false],
    roundNumber: 1,
    maxRounds: 8
};

// Simulated multiplayer state (in real implementation, this would be on server)
let rooms = {};

// Generate Room Code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create Game
function createGame() {
    gameState.roomCode = generateRoomCode();
    gameState.isHost = true;
    gameState.myPlayerId = 0;
    gameState.players[0].connected = true;
    gameState.players[0].name = 'Player 1 (You)';
    gameState.phase = 'lobby';
    
    // Store room in simulated rooms
    rooms[gameState.roomCode] = JSON.parse(JSON.stringify(gameState));
    
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'block';
    updateLobby();
}

// Join Game
function joinGame() {
    const input = document.getElementById('room-code-input');
    const code = input.value.toUpperCase().trim();
    
    if (code.length !== 6) {
        alert('Please enter a valid 6-character room code');
        return;
    }
    
    // In real implementation, check with server
    // For demo, simulate joining
    if (!rooms[code]) {
        alert('Room not found! Please check the code.');
        return;
    }
    
    // Find available slot
    let slotFound = false;
    for (let i = 0; i < 4; i++) {
        if (!rooms[code].players[i].connected) {
            gameState = JSON.parse(JSON.stringify(rooms[code]));
            gameState.myPlayerId = i;
            gameState.players[i].connected = true;
            gameState.players[i].name = `Player ${i + 1} (You)`;
            gameState.phase = 'lobby';
            slotFound = true;
            break;
        }
    }
    
    if (!slotFound) {
        alert('Room is full!');
        return;
    }
    
    rooms[code] = JSON.parse(JSON.stringify(gameState));
    
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'block';
    updateLobby();
}

// Update Lobby
function updateLobby() {
    document.getElementById('lobby-room-code').textContent = gameState.roomCode;
    
    const connectedCount = gameState.players.filter(p => p.connected).length;
    document.getElementById('lobby-status').textContent = `Waiting for players... (${connectedCount}/4)`;
    
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        const player = gameState.players[i];
        const slot = document.createElement('div');
        slot.style.cssText = 'padding: 16px; background: #f5f5f5; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
        
        if (player.connected) {
            slot.style.background = PLAYER_COLORS[i + 1] + '22';
            slot.style.border = `2px solid ${PLAYER_COLORS[i + 1]}`;
            slot.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="width: 12px; height: 12px; background: ${PLAYER_COLORS[i + 1]}; border-radius: 50%;"></span>
                    <span style="font-weight: 600; color: #333;">${player.name}</span>
                </div>
                <span style="font-weight: 600; color: ${player.ready ? '#4CAF50' : '#999'};">${player.ready ? '✓ Ready' : 'Not Ready'}</span>
            `;
        } else {
            slot.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="width: 12px; height: 12px; background: #ccc; border-radius: 50%;"></span>
                    <span style="font-weight: 500; color: #999;">Waiting...</span>
                </div>
            `;
        }
        
        playerList.appendChild(slot);
    }
    
    // Show start button if host and all 4 ready
    const allReady = gameState.players.every(p => p.connected && p.ready);
    const allConnected = gameState.players.every(p => p.connected);
    
    if (gameState.isHost && allReady && allConnected) {
        document.getElementById('start-game-btn').style.display = 'block';
    } else {
        document.getElementById('start-game-btn').style.display = 'none';
    }
}

// Toggle Ready
function toggleReady() {
    const myId = gameState.myPlayerId;
    gameState.players[myId].ready = !gameState.players[myId].ready;
    
    const btn = document.getElementById('ready-lobby-btn');
    if (gameState.players[myId].ready) {
        btn.textContent = 'NOT READY';
        btn.style.background = '#F44336';
    } else {
        btn.textContent = 'READY';
        btn.style.background = '#2196F3';
    }
    
    rooms[gameState.roomCode] = JSON.parse(JSON.stringify(gameState));
    updateLobby();
}

// Copy Room Code
function copyRoomCode() {
    const code = gameState.roomCode;
    navigator.clipboard.writeText(code).then(() => {
        alert('Room code copied to clipboard!');
    }).catch(() => {
        alert('Room code: ' + code);
    });
}

// Leave Lobby
function leaveLobby() {
    location.reload();
}

// Start Game from Lobby
function startGameFromLobby() {
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // Create and shuffle deck
    const deck = createDeck();
    shuffleDeck(deck);
    
    // Deal cards (8 per player)
    dealCards(deck);
    
    // Select random starting player
    gameState.currentPlayer = Math.floor(Math.random() * 4);
    gameState.roundStartPlayer = gameState.currentPlayer;
    
    // Start trump selection phase
    gameState.phase = 'trump_selection';
    gameState.roundNumber = 1;
    showTransitionScreen();
}

// Create Deck
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}

// Shuffle Deck
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

// Deal Cards (8 per player = 32 total)
function dealCards(deck) {
    for (let i = 0; i < 8; i++) {
        for (let p = 0; p < 4; p++) {
            gameState.players[p].hand.push(deck.pop());
        }
    }
}

// Show Transition Screen
function showTransitionScreen() {
    const overlay = document.getElementById('transition-overlay');
    const title = document.getElementById('transition-title');
    const subtitle = document.getElementById('transition-subtitle');
    
    const playerNum = gameState.currentPlayer + 1;
    title.textContent = `PLAYER ${playerNum}'S TURN`;
    title.style.color = PLAYER_COLORS[playerNum];
    
    if (gameState.phase === 'trump_selection') {
        subtitle.textContent = 'Select a trump card or pass? Others look away!';
    } else {
        subtitle.textContent = 'Get ready to play!';
    }
    
    overlay.classList.add('show');
}

// Handle Ready Button
function handleReady() {
    document.getElementById('transition-overlay').classList.remove('show');
    updateDisplay();
    updateActionButtons();
}

// Update Display
function updateDisplay() {
    updateTurnIndicator();
    updateScoreboard();
    updateOpponents();
    updatePlayerHand();
    updatePlayArea();
    updateTrumpIndicator();
    updateRoundIndicator();
}

// Update Round Indicator
function updateRoundIndicator() {
    const indicator = document.getElementById('round-indicator');
    indicator.textContent = `ROUND ${gameState.roundNumber}/${gameState.maxRounds}`;
}

// Update Turn Indicator
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    const playerNum = gameState.currentPlayer + 1;
    indicator.textContent = `PLAYER ${playerNum}'S TURN`;
    indicator.style.backgroundColor = PLAYER_COLORS[playerNum];
}

// Update Scoreboard
function updateScoreboard() {
    for (let i = 0; i < 4; i++) {
        const scoreEl = document.getElementById(`score-p${i + 1}`);
        scoreEl.textContent = `P${i + 1}: ${gameState.players[i].score}`;
    }
}

// Update Opponents Display
function updateOpponents() {
    const opponentArea = document.getElementById('opponent-area');
    opponentArea.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
        if (i === gameState.currentPlayer) continue;
        
        const player = gameState.players[i];
        const opponentDiv = document.createElement('div');
        opponentDiv.className = 'opponent-player';
        
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'opponent-cards';
        
        for (let j = 0; j < player.hand.length; j++) {
            const cardBack = document.createElement('div');
            cardBack.className = 'card-back';
            cardsDiv.appendChild(cardBack);
        }
        
        const info = document.createElement('div');
        info.className = 'opponent-info';
        info.textContent = `Player ${i + 1}: ${player.hand.length} cards`;
        info.style.backgroundColor = PLAYER_COLORS[i + 1];
        
        opponentDiv.appendChild(cardsDiv);
        opponentDiv.appendChild(info);
        opponentArea.appendChild(opponentDiv);
    }
}

// Update Player Hand
function updatePlayerHand() {
    const handEl = document.getElementById('player-hand');
    handEl.innerHTML = '';
    
    const currentPlayerHand = gameState.players[gameState.currentPlayer].hand;
    
    currentPlayerHand.forEach((card, index) => {
        const cardEl = createCardElement(card, index);
        handEl.appendChild(cardEl);
    });
}

// Create Card Element
function createCardElement(card, index) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.index = index;
    
    // Determine card color
    const isRed = card.suit === '♥' || card.suit === '♦';
    cardEl.classList.add(isRed ? 'red' : 'black');
    
    // Check if this is the trump card (has red border)
    const player = gameState.players[gameState.currentPlayer];
    if (player.trumpCard && player.trumpCard.rank === card.rank && player.trumpCard.suit === card.suit) {
        cardEl.style.border = '4px solid #FF0000';
        cardEl.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
    }
    
    // Check if card is playable
    if (gameState.phase === 'playing' && isCardPlayable(card)) {
        cardEl.classList.add('playable');
    }
    
    // Check if card is disabled
    if (gameState.phase === 'playing' && !isCardPlayable(card)) {
        cardEl.classList.add('disabled');
    }
    
    // Check if card is selected
    if (gameState.selectedCard === index) {
        cardEl.classList.add('selected');
    }
    
    // Top left corner
    const topLeft = document.createElement('div');
    topLeft.className = 'card-corner top-left';
    topLeft.innerHTML = `${card.rank}<br>${card.suit}`;
    topLeft.style.color = isRed ? '#FF0000' : '#000000';
    
    // Center rank and suit
    const rank = document.createElement('div');
    rank.className = 'card-rank';
    rank.textContent = card.rank;
    
    const suit = document.createElement('div');
    suit.className = 'card-suit';
    suit.textContent = card.suit;
    
    // Bottom right corner
    const bottomRight = document.createElement('div');
    bottomRight.className = 'card-corner bottom-right';
    bottomRight.innerHTML = `${card.rank}<br>${card.suit}`;
    bottomRight.style.color = isRed ? '#FF0000' : '#000000';
    
    cardEl.appendChild(topLeft);
    cardEl.appendChild(rank);
    cardEl.appendChild(suit);
    cardEl.appendChild(bottomRight);
    
    // Add click handler
    cardEl.addEventListener('click', () => handleCardClick(index));
    
    return cardEl;
}

// Handle Card Click
function handleCardClick(index) {
    const card = gameState.players[gameState.currentPlayer].hand[index];
    
    if (gameState.phase === 'playing' && !isCardPlayable(card)) {
        // Shake animation for invalid card
        const cardEl = document.querySelector(`[data-index="${index}"]`);
        cardEl.classList.add('shake');
        setTimeout(() => cardEl.classList.remove('shake'), 400);
        return;
    }
    
    if (gameState.phase === 'trump_selection' || gameState.phase === 'playing') {
        gameState.selectedCard = index;
        updatePlayerHand();
    }
}

// Check if card is playable
function isCardPlayable(card) {
    // If no cards played yet, any card is playable
    if (!gameState.firstCardSuit) return true;
    
    const currentHand = gameState.players[gameState.currentPlayer].hand;
    const hasSuit = currentHand.some(c => c.suit === gameState.firstCardSuit);
    
    // Must follow suit if have it
    if (hasSuit) {
        return card.suit === gameState.firstCardSuit;
    }
    
    // If don't have suit, can play anything
    return true;
}

// Update Play Area
function updatePlayArea() {
    for (let i = 0; i < 4; i++) {
        const slot = document.getElementById(`slot-${i}`);
        slot.innerHTML = '';
        
        if (gameState.playedCards[i]) {
            const card = gameState.playedCards[i];
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.style.cursor = 'default';
            cardEl.style.transform = 'scale(0.8)';
            
            const isRed = card.suit === '♥' || card.suit === '♦';
            cardEl.classList.add(isRed ? 'red' : 'black');
            
            const rank = document.createElement('div');
            rank.className = 'card-rank';
            rank.textContent = card.rank;
            
            const suit = document.createElement('div');
            suit.className = 'card-suit';
            suit.textContent = card.suit;
            
            cardEl.appendChild(rank);
            cardEl.appendChild(suit);
            
            slot.appendChild(cardEl);
        }
    }
}

// Update Action Buttons
function updateActionButtons() {
    const buttonsContainer = document.getElementById('action-buttons');
    buttonsContainer.innerHTML = '';
    
    if (gameState.phase === 'trump_selection') {
        // Trump selection phase buttons
        const setTrumpBtn = createButton('SET AS TRUMP', 'btn-hide', handleSetTrump);
        setTrumpBtn.disabled = gameState.selectedCard === null;
        const passBtn = createButton('PASS', 'btn-pass', handleTrumpPass);
        
        buttonsContainer.appendChild(setTrumpBtn);
        buttonsContainer.appendChild(passBtn);
    } else if (gameState.phase === 'playing') {
        // Playing phase buttons
        const playBtn = createButton('PLAY CARD', 'btn-play', handlePlayCard);
        playBtn.disabled = gameState.selectedCard === null;
        buttonsContainer.appendChild(playBtn);
    }
}

// Create Button
function createButton(text, className, handler) {
    const btn = document.createElement('button');
    btn.className = `action-btn ${className}`;
    btn.textContent = text;
    btn.addEventListener('click', handler);
    return btn;
}

// Handle Set Trump
function handleSetTrump() {
    if (gameState.selectedCard === null) {
        alert('Please select a card to set as trump!');
        return;
    }
    
    const currentPlayer = gameState.players[gameState.currentPlayer];
    const card = currentPlayer.hand[gameState.selectedCard];
    
    // Set as trump card (stays in hand with red border)
    currentPlayer.trumpCard = card;
    gameState.selectedCard = null;
    
    // Move to playing phase
    gameState.phase = 'playing';
    gameState.trumpSelectionPhase = false;
    gameState.currentPlayer = gameState.roundStartPlayer;
    
    updateDisplay();
    updateActionButtons();
}

// Handle Trump Pass
function handleTrumpPass() {
    gameState.trumpSelectionPassed[gameState.currentPlayer] = true;
    gameState.selectedCard = null;
    
    // Check if all players passed
    const allPassed = gameState.trumpSelectionPassed.every(p => p);
    
    if (allPassed) {
        // No one set trump, start playing phase
        gameState.phase = 'playing';
        gameState.trumpSelectionPhase = false;
        gameState.currentPlayer = gameState.roundStartPlayer;
        showTransitionScreen();
    } else {
        // Move to next player for trump selection
        gameState.currentPlayer = (gameState.currentPlayer + 1) % 4;
        showTransitionScreen();
    }
}

// Handle Play Card
function handlePlayCard() {
    if (gameState.selectedCard === null) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayer];
    const card = currentPlayer.hand[gameState.selectedCard];
    
    // Check if this is the trump card being played
    if (currentPlayer.trumpCard && currentPlayer.trumpCard.rank === card.rank && 
        currentPlayer.trumpCard.suit === card.suit && !gameState.trumpRevealed) {
        gameState.trumpSuit = card.suit;
        gameState.trumpRevealed = true;
    }
    
    // Set first card suit if this is the first card
    if (!gameState.firstCardSuit) {
        gameState.firstCardSuit = card.suit;
    }
    
    // Play the card
    gameState.playedCards[gameState.currentPlayer] = card;
    currentPlayer.hand.splice(gameState.selectedCard, 1);
    gameState.selectedCard = null;
    
    updateDisplay();
    
    // Check if round is complete
    const allPlayed = gameState.playedCards.every(c => c !== null);
    
    if (allPlayed) {
        // Round complete, determine winner
        setTimeout(() => resolveRound(), 1000);
    } else {
        // Move to next player
        gameState.currentPlayer = (gameState.currentPlayer + 1) % 4;
        setTimeout(() => showTransitionScreen(), 500);
    }
}

// Update Trump Indicator
function updateTrumpIndicator() {
    const indicator = document.getElementById('trump-indicator');
    if (gameState.trumpSuit && gameState.trumpRevealed) {
        indicator.textContent = `TRUMP SUIT: ${gameState.trumpSuit}`;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

// Resolve Round
function resolveRound() {
    const winnerIndex = determineRoundWinner();
    const winner = gameState.players[winnerIndex];
    
    // Calculate points
    let points = 0;
    for (const card of gameState.playedCards) {
        if (card) {
            points += RANK_SCORES[card.rank];
        }
    }
    
    winner.score += points;
    gameState.roundNumber++;
    
    // Show winner overlay
    showRoundWinner(winnerIndex + 1, points);
    
    // Clear played cards
    gameState.playedCards = [null, null, null, null];
    gameState.firstCardSuit = null;
    gameState.currentPlayer = winnerIndex;
    gameState.roundStartPlayer = winnerIndex;
    
    // Check if game is over (after 8 rounds)
    const gameOver = gameState.roundNumber >= gameState.maxRounds;
    
    setTimeout(() => {
        document.getElementById('winner-overlay').classList.remove('show');
        
        if (gameOver) {
            showGameWinner();
        } else {
            showTransitionScreen();
        }
    }, 3000);
}

// Determine Round Winner
function determineRoundWinner() {
    let winnerIndex = -1;
    let highestValue = -1;
    
    for (let i = 0; i < 4; i++) {
        const card = gameState.playedCards[i];
        if (!card) continue;
        
        let value = RANK_VALUES[card.rank];
        
        // Trump card beats everything
        if (gameState.trumpSuit && card.suit === gameState.trumpSuit) {
            value += 100;
        }
        // Must be same suit as first card to win (unless trump)
        else if (card.suit !== gameState.firstCardSuit) {
            value = -1;
        }
        
        if (value > highestValue) {
            highestValue = value;
            winnerIndex = i;
        }
    }
    
    return winnerIndex;
}

// Show Round Winner
function showRoundWinner(playerNum, points) {
    const overlay = document.getElementById('winner-overlay');
    const title = document.getElementById('winner-title');
    const subtitle = document.getElementById('winner-subtitle');
    
    title.textContent = `PLAYER ${playerNum} WINS!`;
    title.style.color = PLAYER_COLORS[playerNum];
    subtitle.textContent = `+${points} points`;
    
    // Hide final scores section for round win
    document.getElementById('final-scores').style.display = 'none';
    document.querySelector('.play-again-btn').style.display = 'none';
    
    overlay.classList.add('show');
    
    // Update scoreboard
    updateScoreboard();
}

// Show Game Winner
function showGameWinner() {
    // Find winner
    let maxScore = -1;
    let winnerId = -1;
    
    for (let i = 0; i < 4; i++) {
        if (gameState.players[i].score > maxScore) {
            maxScore = gameState.players[i].score;
            winnerId = i;
        }
    }
    
    const overlay = document.getElementById('winner-overlay');
    const title = document.getElementById('winner-title');
    const subtitle = document.getElementById('winner-subtitle');
    const scoresDiv = document.getElementById('final-scores');
    
    title.textContent = `PLAYER ${winnerId + 1} WINS!`;
    title.style.color = PLAYER_COLORS[winnerId + 1];
    subtitle.textContent = 'Final Scores';
    
    // Show final scores
    scoresDiv.style.display = 'block';
    scoresDiv.innerHTML = '<h3 style="text-align: center; margin-bottom: 16px;">Final Scores</h3>';
    
    for (let i = 0; i < 4; i++) {
        const scoreItem = document.createElement('div');
        scoreItem.className = 'final-score-item';
        scoreItem.innerHTML = `
            <span style="color: ${PLAYER_COLORS[i + 1]}">Player ${i + 1}</span>
            <span>${gameState.players[i].score} pts</span>
        `;
        scoresDiv.appendChild(scoreItem);
    }
    
    document.querySelector('.play-again-btn').style.display = 'block';
    overlay.classList.add('show');
    
    // Add confetti
    createConfetti();
}

// Create Confetti
function createConfetti() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 5000);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Game is ready
});