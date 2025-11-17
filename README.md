# 304 Card Game - Multiplayer Online

A fully functional multiplayer card game with Socket.io real-time communication.

## Features

✅ Online multiplayer with room codes
✅ 4 players per game
✅ Custom player names (editable in lobby)
✅ Real-time synchronization
✅ Trump card mechanics
✅ Full game rules implementation
✅ Mobile-friendly responsive design

## File Structure

```
304-game/
├── server.js           # Node.js + Socket.io backend server
├── package.json        # Dependencies
├── .replit            # Replit configuration
└── public/            # Frontend files (served by Express)
    ├── index.html     # Main HTML
    ├── app.js         # Frontend JavaScript + Socket.io client
    └── style.css      # Styling
```

## Setup Instructions for Replit

### Step 1: Upload Files to Replit

1. Go to Replit.com and open your project
2. Create a folder called `public` in your project root
3. Upload these files to the ROOT directory:
   - `server.js`
   - `package.json`
   - `.replit`

4. Upload these files to the `public/` folder:
   - `index.html`
   - `app.js`
   - `style.css`

### Step 2: Install Dependencies

In the Replit Shell, run:
```bash
npm install
```

This installs:
- express (web server)
- socket.io (real-time communication)

### Step 3: Run the Server

Click the "Run" button in Replit, or in the Shell type:
```bash
npm start
```

The server will start on port 3000.

### Step 4: Get Your Public URL

Replit will automatically give you a public URL like:
```
https://your-project-name.your-username.repl.co
```

Share this URL with your friends to play!

## How to Play

### Create a Game:
1. Enter your name
2. Click "CREATE NEW GAME"
3. Share the 6-character room code with friends

### Join a Game:
1. Enter your name
2. Enter the room code
3. Click "JOIN GAME"

### In the Lobby:
- Click "Edit Name" to change your name
- Click "READY" when you're ready
- Host clicks "START GAME" when all 4 players are ready

### Gameplay:
- Each player gets 8 cards
- First round: players can set a trump card (stays in hand with red border)
- Follow the leading suit if you have it
- Trump suit beats all other suits
- Winner of each round starts the next round
- Game lasts 8 rounds
- Highest score wins!

## Troubleshooting

### "Cannot GET /"
- Make sure all files are in the correct folders
- Check that `public/` folder contains `index.html`

### Players can't join
- Make sure the server is running (green "Run" button)
- Share the full Replit URL (not localhost)
- Check that all 4 players use the SAME room code

### Cards not showing
- Clear browser cache
- Make sure `app.js` and `style.css` are in `public/` folder
- Check browser console for errors (F12)

### Names not updating
- This is fixed in the new backend!
- Each player can only edit their own name
- Names sync to all players in real-time

## Technical Details

### Backend (server.js)
- Express web server
- Socket.io for WebSocket connections
- Room management system
- Game state synchronization
- Turn validation
- Win condition checking

### Frontend (app.js + index.html)
- Socket.io client
- Real-time UI updates
- Card selection and playing
- Lobby system
- Responsive design

## Game Rules

- **Cards**: J(7), 9(6), A(5), 10(4), K(3), Q(2), 8(1), 7(0)
- **Scoring**: J=3, 9=2, A/10/K/Q=1, 8/7=0
- **Trump**: First round, players can set trump (optional)
- **Follow Suit**: Must follow leading suit if you have it
- **Winning**: Highest card in leading suit wins, unless trump played

## Support

If you encounter issues:
1. Check the Replit console for errors
2. Restart the server (Stop + Run)
3. Clear browser cache
4. Try a different browser

Enjoy playing! 🎮🃏
