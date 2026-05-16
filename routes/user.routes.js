import express from "express";
import { checkAuth, login, signup, updateProfile } from "../controllers/user.controller.js";
import { protecRoutes } from "../middleware/auth.middleware.js";

const userRouter = express.Router();

userRouter.post("/signup" , signup);
userRouter.post("/login" , login);
userRouter.post("/update-profile" , protecRoutes , updateProfile);
userRouter.post("/check" , protecRoutes , checkAuth);

export default userRouter ;

