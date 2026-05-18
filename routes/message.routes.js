import express from "express";
import { protecRoutes } from "../middleware/auth.middleware.js";
import {
    createGroup,
    getContactRequests,
    getGroupMessages,
    getMessage,
    getUsersForSidebar,
    markMesageAsSeen,
    respondToContactRequest,
    sendContactRequest,
    sendGroupMessage,
    sendMessage,
    updateGroup,
} from "../controllers/message.controller.js";

const messageRouter = express.Router();

messageRouter.get("/users" , protecRoutes , getUsersForSidebar);
messageRouter.get("/contact-requests" , protecRoutes , getContactRequests);
messageRouter.post("/contact-requests" , protecRoutes , sendContactRequest);
messageRouter.put("/contact-requests/:id" , protecRoutes , respondToContactRequest);
messageRouter.post("/groups" , protecRoutes , createGroup);
messageRouter.put("/groups/:id" , protecRoutes , updateGroup);
messageRouter.get("/groups/:id" , protecRoutes , getGroupMessages);
messageRouter.post("/send-group/:id" , protecRoutes , sendGroupMessage);
messageRouter.get("/:id" , protecRoutes , getMessage);
messageRouter.put("/mark/:id" , protecRoutes , markMesageAsSeen);
messageRouter.put("/marks/:id" , protecRoutes , markMesageAsSeen);
messageRouter.post("/send/:id" , protecRoutes , sendMessage);

export default messageRouter;
