import cloudinary from "../lib/cloudinary.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { io , userSocketMap } from "../server.js";

const populateGroup = (query) => query
    .populate("members", "-password")
    .populate("createdBy", "-password");

// Get All user excapt loged user
export const getUsersForSidebar = async (req , res) => {
    try {
        const userId = req.user._id;
        const filteredUsers = await User.find({_id:{$ne : userId}}).select("-password");
        const groups = await populateGroup(Group.find({members: userId}).sort({updatedAt: -1}));

        //count number of message not seen
        const unseenMessages ={}
        const promises = filteredUsers.map(async(user)=> {
            const messages = await Message.find({senderId : user._id , receiverId: userId , seen:false})
            if(messages.length > 0) {
                unseenMessages[user._id] = messages.length ;
            }
        })
        await Promise.all(promises);
        res.json({success: true , users: filteredUsers , groups , unseenMessages})
    } catch (error) {
        console.log(error.message)
        res.json({success: false ,message:error.message })
    }
}

export const createGroup = async (req, res) => {
    try {
        const { name, memberIds = [] } = req.body;
        const userId = req.user._id.toString();

        if (!name?.trim()) {
            return res.json({ success: false, message: "Group name required" });
        }

        const members = [...new Set([userId, ...memberIds.map((id) => id.toString())])];

        if (members.length < 2) {
            return res.json({ success: false, message: "Select at least one member" });
        }

        const group = await Group.create({
            name: name.trim(),
            members,
            createdBy: userId,
        });

        const populatedGroup = await populateGroup(Group.findById(group._id));

        members.forEach((memberId) => {
            const socketId = userSocketMap[memberId];
            if (socketId) {
                io.to(socketId).emit("newGroup", populatedGroup);
            }
        });

        res.json({ success: true, group: populatedGroup });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// get all msg
export const getMessage = async (req , res) => {
    try {
        const {id: selectedUserId } = req.params ;
        const myId = req.user._id;

        const messages = await  Message.find({
            $or: [
                {senderId: myId , receiverId:selectedUserId},
                {senderId:selectedUserId , receiverId:myId},
            ]
        })
        await Message.updateMany({senderId : selectedUserId , receiverId: myId}, {seen: true});
        res.json({success:true , messages})


    } catch (error) {
        console.log(error.message)
        res.json({success: false ,message:error.message })
    }
}

export const getGroupMessages = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findOne({ _id: groupId, members: userId });
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        const messages = await Message.find({ groupId })
            .populate("senderId", "-password")
            .sort({ createdAt: 1 });

        res.json({ success: true, messages });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// api to mRK MESSAGE AS SEEN
export const markMesageAsSeen = async (req , res) =>{
    try {
        const {id} = req.params;
        await Message.findByIdAndUpdate(id, {seen:true})
        res.json({success: true})

    } catch (error) {
        console.log(error.message)
        res.json({success: false ,message:error.message })
    }
}

//Send Messages 
export const sendMessage = async (req , res) =>{
    try {
        const {text , image} = req.body ;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        let imageUrl ;
        if(image){
            const uploadResponse = await cloudinary.uploader.upload(image)
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image : imageUrl
        })

        // emit new messegae to reciver socket 
        const receiverSocketId = userSocketMap[receiverId];
        if(receiverSocketId){
            io.to(receiverSocketId).emit("newMessage" , newMessage)
        }

        res.json({success: true , newMessage});
    } catch (error) {
        console.log(error.message)
        res.json({success: false ,message:error.message })
    }
}

export const sendGroupMessage = async (req, res) => {
    try {
        const { text, image } = req.body;
        const groupId = req.params.id;
        const senderId = req.user._id;

        const group = await Group.findOne({ _id: groupId, members: senderId });
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        let imageUrl;
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            groupId,
            text,
            image: imageUrl,
        });

        const populatedMessage = await newMessage.populate("senderId", "-password");

        group.members.forEach((memberId) => {
            if (memberId.toString() === senderId.toString()) return;

            const socketId = userSocketMap[memberId.toString()];
            if (socketId) {
                io.to(socketId).emit("newMessage", populatedMessage);
            }
        });

        res.json({ success: true, newMessage: populatedMessage });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};
