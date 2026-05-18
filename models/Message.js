import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId : {type : mongoose.Schema.Types.ObjectId , ref:"User" , required:true},
    receiverId : {type : mongoose.Schema.Types.ObjectId , ref:"User"},
    groupId : {type : mongoose.Schema.Types.ObjectId , ref:"Group"},
    text : {type:String},
    image : {type:String},
    game: {
        type: {
            type: String,
            enum: ["tic-tac-toe"],
        },
        gameId: { type: String },
        players: {
            x: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            o: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        },
        status: {
            type: String,
            enum: ["invited", "playing", "completed"],
            default: "invited",
        },
    },
    codeSpace: {
        codeSpaceId: { type: String },
        language: { type: String, default: "javascript" },
        participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        status: {
            type: String,
            enum: ["invited", "active", "closed"],
            default: "invited",
        },
    },
    seen: {type: Boolean , default: false}
}, {timestamps : true})

const Message = mongoose.model("Message" , messageSchema);

export default Message ;
