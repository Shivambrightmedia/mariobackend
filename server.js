const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Get frontend URL from environment variable or use default
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
const PORT = process.env.PORT || 3000;

// CORS configuration for REST API
app.use(cors({
    origin: FRONTEND_URL.split(',').map(url => url.trim()),
    methods: ['GET', 'POST']
}));

app.use(express.json());

// Socket.io with CORS
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL.split(',').map(url => url.trim()),
        methods: ["GET", "POST"]
    }
});

// Store game rooms
const gameRooms = new Map();

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Mario Game WebSocket Server',
        rooms: gameRooms.size
    });
});

// Generate QR code endpoint
app.get('/api/qrcode/:roomId', async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const frontendBaseUrl = req.query.frontendUrl || FRONTEND_URL.split(',')[0];
        const controllerUrl = `${frontendBaseUrl}/controller.html?room=${roomId}`;

        const qrCodeDataUrl = await QRCode.toDataURL(controllerUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        res.json({
            qrCode: qrCodeDataUrl,
            controllerUrl: controllerUrl,
            roomId: roomId
        });
    } catch (error) {
        console.error('QR Code generation error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Get room info
app.get('/api/room/:roomId', (req, res) => {
    const room = gameRooms.get(req.params.roomId);
    if (room) {
        res.json({
            exists: true,
            controllerCount: room.controllers.length,
            gameStarted: room.gameStarted
        });
    } else {
        res.json({ exists: false });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Game screen creates a room
    socket.on('create-room', (callback) => {
        const roomId = uuidv4().substring(0, 8);
        gameRooms.set(roomId, {
            gameSocketId: socket.id,
            controllers: [],
            gameStarted: false
        });

        socket.join(roomId);
        socket.roomId = roomId;
        socket.isGameScreen = true;

        console.log(`Room created: ${roomId}`);
        callback({ roomId });
    });

    // Controller joins a room
    socket.on('join-room', (roomId, callback) => {
        const room = gameRooms.get(roomId);

        if (!room) {
            callback({ success: false, error: 'Room not found. Please scan the QR code again.' });
            return;
        }

        // Add controller to room
        room.controllers.push(socket.id);
        socket.join(roomId);
        socket.roomId = roomId;
        socket.isController = true;

        // Notify game screen
        io.to(room.gameSocketId).emit('controller-connected', {
            controllerId: socket.id,
            controllerCount: room.controllers.length
        });

        console.log(`Controller ${socket.id} joined room ${roomId}`);
        callback({ success: true, gameStarted: room.gameStarted });
    });

    // Controller sends input
    socket.on('controller-input', (data) => {
        if (!socket.roomId) return;

        const room = gameRooms.get(socket.roomId);
        if (room) {
            io.to(room.gameSocketId).emit('game-input', {
                controllerId: socket.id,
                ...data
            });
        }
    });

    // Start game
    socket.on('start-game', () => {
        if (!socket.roomId) return;

        const room = gameRooms.get(socket.roomId);
        if (room) {
            room.gameStarted = true;
            io.to(room.gameSocketId).emit('game-started');
            // Notify all controllers
            room.controllers.forEach(controllerId => {
                io.to(controllerId).emit('game-started');
            });
            console.log(`Game started in room ${socket.roomId}`);
        }
    });

    // Pause game
    socket.on('pause-game', () => {
        if (!socket.roomId) return;

        const room = gameRooms.get(socket.roomId);
        if (room) {
            io.to(room.gameSocketId).emit('game-paused');
        }
    });

    // Resume game
    socket.on('resume-game', () => {
        if (!socket.roomId) return;

        const room = gameRooms.get(socket.roomId);
        if (room) {
            io.to(room.gameSocketId).emit('game-resumed');
        }
    });

    // Restart game
    socket.on('restart-game', () => {
        if (!socket.roomId) return;

        const room = gameRooms.get(socket.roomId);
        if (room) {
            room.gameStarted = true;
            io.to(room.gameSocketId).emit('game-restart');
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);

        if (socket.roomId) {
            const room = gameRooms.get(socket.roomId);
            if (room) {
                if (socket.isGameScreen) {
                    // Game screen disconnected, destroy room
                    room.controllers.forEach(controllerId => {
                        io.to(controllerId).emit('game-ended', { reason: 'Host disconnected' });
                    });
                    gameRooms.delete(socket.roomId);
                    console.log(`Room ${socket.roomId} destroyed`);
                } else if (socket.isController) {
                    // Controller disconnected
                    room.controllers = room.controllers.filter(id => id !== socket.id);
                    io.to(room.gameSocketId).emit('controller-disconnected', {
                        controllerId: socket.id,
                        controllerCount: room.controllers.length
                    });
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n🎮 Mario Web Game Server Running!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Server:   http://localhost:${PORT}`);
    console.log(`Frontend: ${FRONTEND_URL}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
