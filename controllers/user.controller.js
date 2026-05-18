import cloudinary from "../lib/cloudinary.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs"

const sanitizeUser = (user) => {
    const userObject = user?.toObject ? user.toObject() : user;
    if (!userObject) return userObject;

    const { password, contacts, ...safeUser } = userObject;
    return safeUser;
};

// signup new user 
export const signup = async (req , res) => {
    const {fullname , password , bio} = req.body ;
    const email = req.body.email?.trim().toLowerCase();
    try {
        if (!fullname || !email || !password || !bio){
            return res.json({success: false , message: "Missing Details"})
        }
        const user = await User.findOne({email});

        if(user){
            return res.json({success: false , message: "Account already exists"})
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password , salt);

        const newUser = await User.create({
            fullname, email, password : hashedPassword , bio
        });

        const token = generateToken(newUser._id)
        res.json({success:true , userData : sanitizeUser(newUser) , token , message :"Account create hogya bhau"})
    } catch (error) {
        console.log("bhau account banane me kuch to bhi error ara hai ye line me " + error.message)
        res.json({success:false ,  message :"bhau account banane me kuch to bhi error ara hai ye line me " + error.message})
    }
}


// Login Controller

export const login = async (req , res)=> {
    try {
        const { password } = req.body ;
        const email = req.body.email?.trim().toLowerCase();
        const userData = await User.findOne({email})

        if (!userData) {
          return res.json({success : false , message: "Bhau credentials dekh galat hai"})  
        }

        const isPasswordCorrect = await bcrypt.compare(password , userData.password);

        if (!isPasswordCorrect){
          return res.json({success : false , message: "Bhau credentials dekh galat hai"})  
        }
        const token = generateToken(userData._id)
        res.json({success:true , userData: sanitizeUser(userData)  , token , message :"login hogya bhau"})
    } catch (error) {
         console.log("bhau account banane me kuch to bhi error ara hai ye line me " + error.message)
        res.json({success:false ,  message :"bhau account banane me kuch to bhi error ara hai ye line me " + error})
    }
}

// Check user is Authenticate 

export const checkAuth = (req , res) => {
    res.json({success: true , user : sanitizeUser(req.user)});
}

// Controller to update profile 
export const updateProfile = async (req, res) =>{
    try {
        const {profilePic , bio , fullname} = req.body ;

        const userId = req.user._id;
        let updateUser ;

        if(!profilePic){
            updateUser = await User.findByIdAndUpdate(userId , {bio , fullname} ,{returnDocument: "after"});
        } else{
            const upload = await cloudinary.uploader.upload(profilePic);
            
            updateUser = await User.findByIdAndUpdate(userId , {profilePic : upload.secure_url , bio , fullname}, {returnDocument: "after"});
        }
        res.json({success: true , user : sanitizeUser(updateUser)})
    } catch (error) {
        console.log(error.message);
        res.json({success: false , message : error.message})
    }
}
