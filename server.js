import express from "express";
import "dotenv/config";
import cors from "cors"
import http from "http"
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/user.routes.js";
import messageRouter from "./routes/message.routes.js";
import { Server } from "socket.io";


// Create express app and http
const app = express();
const server = http.createServer(app)


// Initialize socket server
export const io = new Server(server , {
    cors: {origin : "*"}
})

// store online users
export const userSocketMap = {}; // {userId : socketId}

//Socket Handler
io.on("connection" ,(socket) =>{
    const userId = socket.handshake.query.userId;
    console.log("User connected" , userId);

    if(userId) userSocketMap[userId] = socket.id;

    //Emit online user to all conected client
    io.emit("getOnlineUsers" , Object.keys(userSocketMap));

    socket.on("typing", ({ receiverId }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if(receiverSocketId) {
            io.to(receiverSocketId).emit("typing", { senderId: userId });
        }
    })

    socket.on("stopTyping", ({ receiverId }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if(receiverSocketId) {
            io.to(receiverSocketId).emit("stopTyping", { senderId: userId });
        }
    })

    socket.on("disconnect" , () =>{
        console.log("user disconnected" , userId);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers" , Object.keys(userSocketMap));
    })
    console.log("socket shuru hai bhau");
})

//Middleware setup
app.use(express.json({limit:"4mb"}));
app.use(cors());

//Routes
app.use("/api/status" ,(req, res)=> res.send("bhau server shuru hai") );

app.use("/api/auth" , userRouter);

app.use("/api/messages" , messageRouter);
//MONGODB
await connectDB();

//Port 
const PORT = process.env.PORT || 3000 ;
server.listen(PORT , () => console.log("server bhi shuru hai ye Port no: " + PORT + " par"));
