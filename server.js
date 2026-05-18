import express from "express";
import "dotenv/config";
import cors from "cors"
import http from "http"
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/user.routes.js";
import messageRouter from "./routes/message.routes.js";
import { Server } from "socket.io";

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8081",
    "http://localhost:8082",
    "https://tech-chat-dun.vercel.app",
]

const isLocalDevOrigin = (origin) => (
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "token"],
    credentials: true,
}


// Create express app and http
const app = express();
const server = http.createServer(app)


// Initialize socket server
export const io = new Server(server , {
    cors: corsOptions
})

// store online users
export const userSocketMap = {}; // { userId: Set<socketId> }

const addUserSocket = (userId, socketId) => {
    if (!userId) return;

    if (!userSocketMap[userId]) {
        userSocketMap[userId] = new Set();
    }

    userSocketMap[userId].add(socketId);
};

const removeUserSocket = (userId, socketId) => {
    if (!userId || !userSocketMap[userId]) return;

    userSocketMap[userId].delete(socketId);

    if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
    }
};

export const getUserSocketIds = (userId) => (
    Array.from(userSocketMap[userId?.toString()] || [])
);

export const emitToUser = (userId, event, payload) => {
    getUserSocketIds(userId).forEach((socketId) => {
        io.to(socketId).emit(event, payload);
    });
};

const gameStates = {};
const codeSpaceStates = {};

const getInitialGameState = (players) => ({
    board: Array(9).fill(null),
    currentTurn: "x",
    status: "playing",
    winner: null,
    players,
});

const getWinner = (board) => {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    const winningLine = lines.find(([a, b, c]) => (
        board[a] && board[a] === board[b] && board[a] === board[c]
    ));

    if (winningLine) {
        return { symbol: board[winningLine[0]], line: winningLine };
    }

    if (board.every(Boolean)) {
        return { symbol: "draw", line: [] };
    }

    return null;
};

const getInitialCodeSpaceState = (participants = [], language = "javascript") => ({
    content: "",
    language,
    participants,
    updatedBy: null,
    updatedAt: new Date().toISOString(),
});

//Socket Handler
io.on("connection" ,(socket) =>{
    const userId = socket.handshake.query.userId;
    console.log("User connected" , userId);

    if(userId) addUserSocket(userId, socket.id);

    //Emit online user to all conected client
    io.emit("getOnlineUsers" , Object.keys(userSocketMap));

    socket.on("typing", ({ receiverId }) => {
        emitToUser(receiverId, "typing", { senderId: userId });
    })

    socket.on("stopTyping", ({ receiverId }) => {
        emitToUser(receiverId, "stopTyping", { senderId: userId });
    })

    socket.on("groupTyping", ({ groupId, members = [], senderName }) => {
        members.forEach((memberId) => {
            if(memberId === userId) return;

            emitToUser(memberId, "groupTyping", { groupId, senderId: userId, senderName });
        })
    })

    socket.on("groupStopTyping", ({ groupId, members = [] }) => {
        members.forEach((memberId) => {
            if(memberId === userId) return;

            emitToUser(memberId, "groupStopTyping", { groupId, senderId: userId });
        })
    })

    socket.on("game:join", ({ gameId, players }) => {
        if (!gameId || !players?.x || !players?.o) return;

        socket.join(gameId);

        if (!gameStates[gameId]) {
            gameStates[gameId] = getInitialGameState(players);
        }

        io.to(gameId).emit("game:state", { gameId, state: gameStates[gameId] });
    })

    socket.on("game:move", ({ gameId, index }) => {
        const gameState = gameStates[gameId];
        if (!gameState || gameState.status !== "playing") return;
        if (!Number.isInteger(index) || index < 0 || index > 8 || gameState.board[index]) return;

        const symbol = gameState.players.x?.toString() === userId?.toString()
            ? "x"
            : gameState.players.o?.toString() === userId?.toString()
                ? "o"
                : null;

        if (!symbol || symbol !== gameState.currentTurn) return;

        gameState.board[index] = symbol;
        const winner = getWinner(gameState.board);

        if (winner) {
            gameState.status = "completed";
            gameState.winner = winner;
        } else {
            gameState.currentTurn = symbol === "x" ? "o" : "x";
        }

        io.to(gameId).emit("game:state", { gameId, state: gameState });
    })

    socket.on("game:restart", ({ gameId }) => {
        const gameState = gameStates[gameId];
        if (!gameState) return;

        gameStates[gameId] = getInitialGameState(gameState.players);
        io.to(gameId).emit("game:state", { gameId, state: gameStates[gameId] });
    })

    socket.on("code:join", ({ codeSpaceId, participants = [], language = "javascript" }) => {
        if (!codeSpaceId) return;

        socket.join(codeSpaceId);

        if (!codeSpaceStates[codeSpaceId]) {
            codeSpaceStates[codeSpaceId] = getInitialCodeSpaceState(participants, language);
        }

        io.to(codeSpaceId).emit("code:state", {
            codeSpaceId,
            state: codeSpaceStates[codeSpaceId],
        });
    })

    socket.on("code:update", ({ codeSpaceId, content, language }) => {
        if (!codeSpaceId || typeof content !== "string") return;

        const previousState = codeSpaceStates[codeSpaceId] || getInitialCodeSpaceState();
        codeSpaceStates[codeSpaceId] = {
            ...previousState,
            content,
            language: language || previousState.language,
            updatedBy: userId,
            updatedAt: new Date().toISOString(),
        };

        socket.to(codeSpaceId).emit("code:state", {
            codeSpaceId,
            state: codeSpaceStates[codeSpaceId],
        });
    })

    socket.on("code:language", ({ codeSpaceId, language }) => {
        if (!codeSpaceId || !language) return;

        const previousState = codeSpaceStates[codeSpaceId] || getInitialCodeSpaceState();
        codeSpaceStates[codeSpaceId] = {
            ...previousState,
            language,
            updatedBy: userId,
            updatedAt: new Date().toISOString(),
        };

        io.to(codeSpaceId).emit("code:state", {
            codeSpaceId,
            state: codeSpaceStates[codeSpaceId],
        });
    })

    socket.on("disconnect" , () =>{
        console.log("user disconnected" , userId);
        removeUserSocket(userId, socket.id);
        io.emit("getOnlineUsers" , Object.keys(userSocketMap));
    })
    console.log("socket shuru hai bhau");
})

//Middleware setup
app.use(cors(corsOptions));
app.use(express.json({limit:"4mb"}));

//Routes
app.use("/api/status" ,(req, res)=> res.send("bhau server shuru hai") );

app.use("/api/auth" , userRouter);

app.use("/api/messages" , messageRouter);
//MONGODB
await connectDB();

//Port 
const PORT = process.env.PORT || 3000 ;
server.listen(PORT , () => console.log("server bhi shuru hai ye Port no: " + PORT + " par"));
