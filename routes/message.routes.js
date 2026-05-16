import express from "express";
import { protecRoutes } from "../middleware/auth.middleware.js";
import { getMessage, getUsersForSidebar, markMesageAsSeen, sendMessage } from "../controllers/message.controller.js";

const messageRouter = express.Router();

messageRouter.get("/users" , protecRoutes , getUsersForSidebar);
messageRouter.get("/:id" , protecRoutes , getMessage);
messageRouter.put("/mark/:id" , protecRoutes , markMesageAsSeen);
messageRouter.put("/marks/:id" , protecRoutes , markMesageAsSeen);
messageRouter.post("/send/:id" , protecRoutes , sendMessage);

export default messageRouter;
