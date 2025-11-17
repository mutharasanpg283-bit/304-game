const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static('public'));

// Game state storage
const games = new Map(); // roomCode -> game state
const playerSockets = new Map(); // socketId -> {roomCode, playerId}

// Card data from your Python file
const cardsHierarchy = {'J': 7, '9': 6, 'A': 5, '10': 4, 'K': 3, 'Q': 2, '8': 1, '7': 0};
const cardsScores = {'J': 3, '9': 2, 'A': 1, '10': 1, 'K': 1, 'Q': 1, '8': 0, '7': 0};
const suits = ['♥', '♣', '♠', '♦'];

// Generate room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create deck and shuffle
function createDeck() {
  const deck = [];
  for (const card in cardsHierarchy) {
    for (const suit of suits) {
      deck.push(`${card} of ${suit}`);
    }
  }
  return shuffleArray(deck);
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Deal cards to players
function dealCards() {
  const deck = createDeck();
  const hands = [[], [], [], []];
  for (let i = 0; i < deck.length; i++) {
    hands[i % 4].push(deck[i]);
  }
  return hands;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create game
  socket.on('createGame', (playerName, callback) => {
    const roomCode = generateRoomCode();
    const gameState = {
      roomCode,
      players: [
        { id: socket.id, name: playerName || 'Player 1', ready: false, isHost: true }
      ],
      phase: 'lobby',
      currentPlayerIndex: 0,
      currentRound: 1,
      maxRounds: 8,
      cardsInPlay: [],
      leadingSuit: null,
      trumpCard: null,
      trumpSuit: null,
      trumpRevealed: false,
      hands: [[], [], [], []],
      scores: [0, 0, 0, 0]
    };

    games.set(roomCode, gameState);
    playerSockets.set(socket.id, { roomCode, playerId: 0 });
    socket.join(roomCode);

    console.log(`Game created: ${roomCode} by ${playerName}`);
    callback({ success: true, roomCode, playerId: 0 });
  });

  // Join game
  socket.on('joinGame', (data, callback) => {
    const { roomCode, playerName } = data;
    const game = games.get(roomCode);

    if (!game) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (game.players.length >= 4) {
      callback({ success: false, error: 'Room is full' });
      return;
    }

    if (game.phase !== 'lobby') {
      callback({ success: false, error: 'Game already started' });
      return;
    }

    const playerId = game.players.length;
    game.players.push({
      id: socket.id,
      name: playerName || `Player ${playerId + 1}`,
      ready: false,
      isHost: false
    });

    playerSockets.set(socket.id, { roomCode, playerId });
    socket.join(roomCode);

    console.log(`${playerName} joined room ${roomCode}`);

    // Notify all players in room
    io.to(roomCode).emit('playerJoined', {
      players: game.players,
      playerId
    });

    callback({ success: true, playerId, players: game.players });
  });

  // Update player name
  socket.on('updatePlayerName', (data) => {
    const { roomCode, playerId, newName } = data;
    const game = games.get(roomCode);

    if (game && game.players[playerId]) {
      game.players[playerId].name = newName;
      io.to(roomCode).emit('playerUpdated', {
        playerId,
        name: newName,
        players: game.players
      });
    }
  });

  // Player ready
  socket.on('playerReady', (data) => {
    const { roomCode, playerId } = data;
    const game = games.get(roomCode);

    if (game && game.players[playerId]) {
      game.players[playerId].ready = true;
      io.to(roomCode).emit('playerReadyUpdate', {
        playerId,
        players: game.players
      });
    }
  });

  // Start game
  socket.on('startGame', (roomCode) => {
    const game = games.get(roomCode);

    if (!game || game.players.length !== 4) {
      return;
    }

    // Check all players ready
    const allReady = game.players.every(p => p.ready);
    if (!allReady) {
      socket.emit('error', { message: 'Not all players are ready' });
      return;
    }

    // Deal cards
    game.hands = dealCards();
    game.phase = 'trump-selection';
    game.currentPlayerIndex = Math.floor(Math.random() * 4);

    // Send game start to all players
    game.players.forEach((player, idx) => {
      io.to(player.id).emit('gameStarted', {
        gameState: {
          ...game,
          myHand: game.hands[idx],
          myPlayerId: idx,
          hands: undefined // Don't send all hands
        }
      });
    });

    console.log(`Game started in room ${roomCode}`);
  });

  // Set trump card
  socket.on('setTrumpCard', (data) => {
    const { roomCode, playerId, card } = data;
    const game = games.get(roomCode);

    if (game && game.currentPlayerIndex === playerId) {
      game.trumpCard = { playerId, card };
      // Ensure the player who selected trump starts the round
      game.currentPlayerIndex = playerId;
      // Move to play phase (use 'play' to match client-side phase value)
      game.phase = 'play';

      io.to(roomCode).emit('trumpCardSet', {
        playerId,
        trumpSet: true,
        currentPlayerIndex: game.currentPlayerIndex
      });
    }
  });

  // Pass trump selection
  socket.on('passTrump', (data) => {
    const { roomCode } = data;
    const game = games.get(roomCode);

    if (game) {
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % 4;

      io.to(roomCode).emit('trumpPassed', {
        currentPlayerIndex: game.currentPlayerIndex
      });
    }
  });

  // Play card
  socket.on('playCard', (data) => {
    const { roomCode, playerId, card } = data;
    const game = games.get(roomCode);

    if (!game || game.currentPlayerIndex !== playerId) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Enforce follow-suit: if a leading suit is set and player has that suit, they must play it
    const cardSuit = card.split(' ')[2];
    if (game.leadingSuit) {
      const playerHasLeading = game.hands[playerId].some(c => c.split(' ')[2] === game.leadingSuit);
      if (playerHasLeading && cardSuit !== game.leadingSuit) {
        socket.emit('error', { message: 'You must follow the leading suit.' });
        return;
      }
    }

    // Remove card from player's hand
    const cardIndex = game.hands[playerId].indexOf(card);
    if (cardIndex === -1) {
      socket.emit('error', { message: 'Invalid card' });
      return;
    }
    game.hands[playerId].splice(cardIndex, 1);

    // Add to cards in play
    game.cardsInPlay.push({ playerId, card });

    // Set leading suit if first card
    if (game.cardsInPlay.length === 1) {
      game.leadingSuit = card.split(' ')[2]; // Extract suit
    }

    // Check if trump revealed
    if (game.trumpCard && game.trumpCard.card === card && !game.trumpRevealed) {
      game.trumpSuit = card.split(' ')[2];
      game.trumpRevealed = true;
      io.to(roomCode).emit('trumpRevealed', { trumpSuit: game.trumpSuit });
    }

    // Broadcast card played
    io.to(roomCode).emit('cardPlayed', {
      playerId,
      card,
      cardsInPlay: game.cardsInPlay,
      leadingSuit: game.leadingSuit
    });

    // Check if round complete
    if (game.cardsInPlay.length === 4) {
      setTimeout(() => {
        const winner = determineRoundWinner(game);
        const points = calculateRoundPoints(game.cardsInPlay);
        game.scores[winner] += points;

        io.to(roomCode).emit('roundComplete', {
          winner,
          points,
          scores: game.scores
        });

        // Reset for next round
        game.cardsInPlay = [];
        game.leadingSuit = null;
        game.currentPlayerIndex = winner;
        game.currentRound++;

        if (game.currentRound > 8) {
          // Game over
          const finalWinner = game.scores.indexOf(Math.max(...game.scores));
          io.to(roomCode).emit('gameOver', {
            winner: finalWinner,
            scores: game.scores
          });
          game.phase = 'game-end';
        } else {
          setTimeout(() => {
            io.to(roomCode).emit('nextRound', {
              currentRound: game.currentRound,
              currentPlayerIndex: game.currentPlayerIndex
            });
          }, 3000);
        }
      }, 2000);
    } else {
      // Next player's turn
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % 4;
      io.to(roomCode).emit('nextTurn', {
        currentPlayerIndex: game.currentPlayerIndex
      });
      // Inform the next player privately that they can request a trump reveal
      if (game.leadingSuit && game.trumpCard && !game.trumpRevealed) {
        const nextPlayerId = game.currentPlayerIndex;
        const nextPlayerHasSuit = game.hands[nextPlayerId].some(c => c.split(' ')[2] === game.leadingSuit);
        if (!nextPlayerHasSuit) {
          // find the socket for next player
          for (const [sockId, pd] of playerSockets.entries()) {
            if (pd.roomCode === roomCode && pd.playerId === nextPlayerId) {
              io.to(sockId).emit('revealAvailable', { canReveal: true });
              break;
            }
          }
        }
      }
    }
  });

  // Player asks for a private reveal of the selected trump suit
  socket.on('askRevealTrump', (data) => {
    const { roomCode, playerId } = data;
    const game = games.get(roomCode);

    if (!game) return;

    // Only allow reveal if player cannot follow the leading suit and trump is set but not globally revealed
    if (game.leadingSuit && game.trumpCard && !game.trumpRevealed) {
      const playerHasLeading = game.hands[playerId].some(c => c.split(' ')[2] === game.leadingSuit);
      if (!playerHasLeading) {
        // Send reveal to this socket only
        socket.emit('revealTrumpPrivate', { trumpSuit: game.trumpCard.card.split(' ')[2] });
      } else {
        socket.emit('error', { message: 'You still have the leading suit; cannot reveal.' });
      }
    } else {
      socket.emit('error', { message: 'No trump set or already revealed.' });
    }
  });

  // Determine round winner
  function determineRoundWinner(game) {
    const { cardsInPlay, leadingSuit, trumpSuit } = game;

    // Check for trump cards
    const trumpCards = cardsInPlay.filter(c => c.card.split(' ')[2] === trumpSuit);
    if (trumpCards.length > 0) {
      return getHighestCard(trumpCards).playerId;
    }

    // Highest in leading suit
    const leadingCards = cardsInPlay.filter(c => c.card.split(' ')[2] === leadingSuit);
    return getHighestCard(leadingCards).playerId;
  }

  function getHighestCard(cards) {
    return cards.reduce((highest, current) => {
      const currentRank = current.card.split(' ')[0];
      const highestRank = highest.card.split(' ')[0];
      return cardsHierarchy[currentRank] > cardsHierarchy[highestRank] ? current : highest;
    });
  }

  function calculateRoundPoints(cardsInPlay) {
    return cardsInPlay.reduce((sum, c) => {
      const rank = c.card.split(' ')[0];
      return sum + cardsScores[rank];
    }, 0);
  }

  // Leave game
  socket.on('leaveGame', () => {
    const playerData = playerSockets.get(socket.id);
    if (playerData) {
      const { roomCode, playerId } = playerData;
      const game = games.get(roomCode);

      if (game) {
        game.players[playerId] = { ...game.players[playerId], disconnected: true };
        io.to(roomCode).emit('playerLeft', { playerId, players: game.players });
      }

      playerSockets.delete(socket.id);
      socket.leave(roomCode);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const playerData = playerSockets.get(socket.id);

    if (playerData) {
      const { roomCode, playerId } = playerData;
      const game = games.get(roomCode);

      if (game && game.phase === 'lobby') {
        // Remove from lobby
        game.players.splice(playerId, 1);
        io.to(roomCode).emit('playerLeft', { playerId, players: game.players });
      } else if (game) {
        // Mark as disconnected during game
        game.players[playerId] = { ...game.players[playerId], disconnected: true };
        io.to(roomCode).emit('playerDisconnected', { playerId });
      }

      playerSockets.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Game server running on port ${PORT}`);
});
