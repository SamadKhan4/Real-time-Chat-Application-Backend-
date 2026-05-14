import mongoose, { mongo } from "mongoose";

// function to connect to mongoDB
export const connectDB = async () =>{
    try {
        mongoose.connection.on('connected' , () => console.log("Database connect hogya Bhau"));
        await mongoose.connect(`${process.env.MONGO_URI}`)
    }catch (error) {
        console.log("there is a error in " + error);
    }
}