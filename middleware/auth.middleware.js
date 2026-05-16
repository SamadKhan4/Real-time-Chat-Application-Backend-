import jwt from "jsonwebtoken";
import User from "../models/User.js";


// middleware for protect routes
export const protecRoutes = async (req , res , next) => {
    try {
        const token = req.headers.token ;

        if (!token) return res.json({success: false, message: "Token missing"});

        const decoded = jwt.verify(token , process.env.JWT_SECRET)

        const user = await User.findById(decoded.userId).select("-password");

        if(!user) return res.json({success: false, message: "User nhi milra "});
        
        req.user = user ;
        next();
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message});
    }
}
