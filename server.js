import express from "express";
import "dotenv/config";
import cors from "cors"
import http from "http"
import { connectDB } from "./lib/db.js";

// Create express app and http
const app = express();
const server = http.createServer(app)

//Middleware setup
app.use(express.json({limit:"4mb"}));
app.use(cors());

//Routes
app.use("/api/status" ,(req, res)=> res.send("bhau server shuru hai") );

//MONGODB
await connectDB();

//Port 
const PORT = process.env.PORT || 3000 ;
server.listen(PORT , () => console.log("server bhi shuru hai ye Port no: " + PORT + " par"));