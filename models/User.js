import mongoose from "mongoose";
import { time, timeStamp } from "node:console";
import { type } from "node:os";

const userSchema = new.mongoose.Schema({
    email : {type : String , required : true , unique : true} ,
    fullname : {type : String , required : true } ,
    password : {type : String , required : true , minlength : 6 } ,
    profilePic : {type : String , default : ""} ,
    bioi : {type : String } ,
}, {timeStamp : true})

const User = mongoose.model("User" , userSchema);

export default User ;