# Mario Web Game - Backend

WebSocket server for the Super Mario Web game with mobile controller support.

## Local Development

```bash
npm install
npm start
```

Server will run on `http://localhost:3000`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `FRONTEND_URL` | Allowed CORS origins (comma-separated) | http://localhost:5500 |

## Deployment

### Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the root directory to `backend`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variable: `FRONTEND_URL=https://your-app.netlify.app`

### Railway

1. Create a new project on Railway
2. Deploy from GitHub (point to `backend` folder)
3. Add environment variable: `FRONTEND_URL=https://your-app.netlify.app`

### Heroku

```bash
heroku create your-mario-backend
heroku config:set FRONTEND_URL=https://your-app.netlify.app
git subtree push --prefix backend heroku main
```

## API Endpoints

- `GET /` - Health check
- `GET /api/qrcode/:roomId?frontendUrl=URL` - Generate QR code for controller
- `GET /api/room/:roomId` - Get room info

## WebSocket Events

### Client → Server

- `create-room` - Create a new game room
- `join-room` - Join an existing room
- `controller-input` - Send controller input
- `start-game` - Start the game
- `pause-game` - Pause the game
- `resume-game` - Resume the game
- `restart-game` - Restart after game over

### Server → Client

- `controller-connected` - A controller joined
- `controller-disconnected` - A controller left
- `game-input` - Input from controller
- `game-started` - Game has started
- `game-paused` - Game is paused
- `game-resumed` - Game resumed
- `game-restart` - Game restarting
- `game-ended` - Game session ended
