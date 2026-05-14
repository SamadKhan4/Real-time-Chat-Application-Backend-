import { generateToken } from "../lib/utils";
import User from "../models/User";
import bcrypt from "bcryptjs"


// signup new user 
export const signup = async (req , res) => {
    const {fullname , email , password , bio} = req.body ;
    try {
        if (!fullname || !email || !password || !bio){
            return res.json({success: false , messaeg: "Missing Details"})
        }
        const user = await User.findOne({email});

        if(user){
            return res.json({success: false , messaeg: "Acount already exits"})
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password , salt);

        const newUser = await User.create({
            fullname, email, password : hashedPassword , bio
        });

        const token = generateToken(newUser._id)
        res.json({success:true , userData : newUser , token , message :"Account create hogya bhau"})
    } catch (error) {
        console.log("bhau account banane me kuch to bhi error ara hai ye line me " + error.message)
        res.json({success:false ,  message :"bhau account banane me kuch to bhi error ara hai ye line me " + error.message})
    }
}


// Login Controller

export const login = async (req , res)=> {
    try {
        const { email , password } = req.body ;
        const userData = await User.findOne({email})

        const isPasswordCorrect = await bcrypt.compare(process , userData.password);

        if (!isPasswordCorrect){
            
        }
    } catch (error) {
        
    }
}