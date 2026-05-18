import cloudinary from "../lib/cloudinary.js";
import ContactRequest from "../models/ContactRequest.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { emitToUser } from "../server.js";

const populateGroup = (query) => query
    .populate("members", "-password -contacts")
    .populate("createdBy", "-password -contacts");

const userPublicFields = "-password -contacts";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isConnectedContact = async (userId, contactId) => {
    const user = await User.findOne({ _id: userId, contacts: contactId }).select("_id");
    return Boolean(user);
};

const populateContactRequest = (query) => query
    .populate("requester", userPublicFields)
    .populate("recipient", userPublicFields);

// Get All user excapt loged user
export const getUsersForSidebar = async (req , res) => {
    try {
        const userId = req.user._id;
        const currentUser = await User.findById(userId).select("contacts");
        const contactIds = currentUser?.contacts || [];
        const filteredUsers = await User.find({_id:{$in : contactIds}}).select(userPublicFields);
        const groups = await populateGroup(Group.find({members: userId}).sort({updatedAt: -1}));
        const contactRequests = await populateContactRequest(
            ContactRequest.find({ recipient: userId, status: "pending" }).sort({ createdAt: -1 })
        );

        //count number of message not seen
        const unseenMessages ={}
        const promises = filteredUsers.map(async(user)=> {
            const messages = await Message.find({senderId : user._id , receiverId: userId , seen:false})
            if(messages.length > 0) {
                unseenMessages[user._id] = messages.length ;
            }
        })
        await Promise.all(promises);
        res.json({success: true , users: filteredUsers , groups , unseenMessages, contactRequests})
    } catch (error) {
        console.log(error.message)
        res.json({success: false ,message:error.message })
    }
}

export const sendContactRequest = async (req, res) => {
    try {
        const requesterId = req.user._id;
        const email = req.body.email?.trim().toLowerCase();

        if (!email) {
            return res.json({ success: false, message: "Email required" });
        }

        const recipient = await User.findOne({
            email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
        }).select(userPublicFields);

        if (!recipient) {
            return res.json({ success: false, message: "User not found" });
        }

        if (recipient._id.toString() === requesterId.toString()) {
            return res.json({ success: false, message: "You cannot add yourself" });
        }

        if (await isConnectedContact(requesterId, recipient._id)) {
            return res.json({ success: false, message: "User is already in your contacts" });
        }

        const existingPendingRequest = await ContactRequest.findOne({
            status: "pending",
            $or: [
                { requester: requesterId, recipient: recipient._id },
                { requester: recipient._id, recipient: requesterId },
            ],
        });

        if (existingPendingRequest) {
            return res.json({ success: false, message: "Contact request already pending" });
        }

        const request = await ContactRequest.create({
            requester: requesterId,
            recipient: recipient._id,
        });
        const populatedRequest = await populateContactRequest(ContactRequest.findById(request._id));

        emitToUser(recipient._id, "contactRequest:new", populatedRequest);

        res.json({ success: true, contactRequest: populatedRequest, message: "Contact request sent" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const getContactRequests = async (req, res) => {
    try {
        const userId = req.user._id;
        const incoming = await populateContactRequest(
            ContactRequest.find({ recipient: userId, status: "pending" }).sort({ createdAt: -1 })
        );
        const outgoing = await populateContactRequest(
            ContactRequest.find({ requester: userId, status: "pending" }).sort({ createdAt: -1 })
        );

        res.json({ success: true, incoming, outgoing });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const respondToContactRequest = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;
        const { action } = req.body;

        if (!["accept", "decline"].includes(action)) {
            return res.json({ success: false, message: "Invalid action" });
        }

        const request = await ContactRequest.findOne({
            _id: id,
            recipient: userId,
            status: "pending",
        });

        if (!request) {
            return res.json({ success: false, message: "Contact request not found" });
        }

        if (action === "decline") {
            request.status = "declined";
            await request.save();

            emitToUser(request.requester, "contactRequest:declined", { requestId: request._id });

            return res.json({ success: true, message: "Contact request declined" });
        }

        await User.findByIdAndUpdate(request.requester, { $addToSet: { contacts: request.recipient } });
        await User.findByIdAndUpdate(request.recipient, { $addToSet: { contacts: request.requester } });

        request.status = "accepted";
        await request.save();

        const connectedUser = await User.findById(request.requester).select(userPublicFields);
        const acceptingUser = await User.findById(request.recipient).select(userPublicFields);

        emitToUser(request.requester, "contactRequest:accepted", {
            requestId: request._id,
            user: acceptingUser,
        });

        res.json({ success: true, user: connectedUser, message: "Contact request accepted" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const createGroup = async (req, res) => {
    try {
        const { name, bio = "", memberIds = [] } = req.body;
        const userId = req.user._id.toString();

        if (!name?.trim()) {
            return res.json({ success: false, message: "Group name required" });
        }

        const requestedMemberIds = memberIds.map((id) => id.toString());
        const currentUser = await User.findById(userId).select("contacts");
        const contactIdSet = new Set((currentUser?.contacts || []).map((id) => id.toString()));

        const invalidMemberId = requestedMemberIds.find((id) => !contactIdSet.has(id));
        if (invalidMemberId) {
            return res.json({ success: false, message: "Groups can only include accepted contacts" });
        }

        const members = [...new Set([userId, ...requestedMemberIds])];

        if (members.length < 2) {
            return res.json({ success: false, message: "Select at least one member" });
        }

        const group = await Group.create({
            name: name.trim(),
            bio: bio.trim(),
            members,
            createdBy: userId,
        });

        const populatedGroup = await populateGroup(Group.findById(group._id));

        members.forEach((memberId) => {
            emitToUser(memberId, "newGroup", populatedGroup);
        });

        res.json({ success: true, group: populatedGroup });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

export const updateGroup = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const { name, bio, groupPic } = req.body;
        const userId = req.user._id;

        const group = await Group.findOne({ _id: groupId, members: userId });
        if (!group) {
            return res.json({ success: false, message: "Group not found" });
        }

        const updates = {};

        if (name !== undefined) {
            if (!name.trim()) {
                return res.json({ success: false, message: "Group name required" });
            }
            updates.name = name.trim();
        }

        if (bio !== undefined) {
            updates.bio = bio.trim();
        }

        if (groupPic) {
            const uploadResponse = await cloudinary.uploader.upload(groupPic);
            updates.groupPic = uploadResponse.secure_url;
        }

        const updatedGroup = await populateGroup(
            Group.findByIdAndUpdate(groupId, updates, { returnDocument: "after" })
        );

        updatedGroup.members.forEach((member) => {
            emitToUser(member._id, "groupUpdated", updatedGroup);
        });

        res.json({ success: true, group: updatedGroup });
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

        if (!(await isConnectedContact(myId, selectedUserId))) {
            return res.json({ success: false, message: "Accept contact request before chatting" });
        }

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
            .populate("senderId", userPublicFields)
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
        const {text , image, game} = req.body ;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        if (!(await isConnectedContact(senderId, receiverId))) {
            return res.json({ success: false, message: "Accept contact request before chatting" });
        }

        let imageUrl ;
        if(image){
            const uploadResponse = await cloudinary.uploader.upload(image)
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image : imageUrl,
            game
        })

        // emit new messegae to reciver socket 
        emitToUser(receiverId, "newMessage", newMessage);

        res.json({success: true , newMessage});
    } catch (error) {
        console.log(error.message)
        res.json({success: false ,message:error.message })
    }
}

export const sendGroupMessage = async (req, res) => {
    try {
        const { text, image, game } = req.body;
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
            game,
        });

        const populatedMessage = await newMessage.populate("senderId", userPublicFields);

        group.members.forEach((memberId) => {
            if (memberId.toString() === senderId.toString()) return;

            emitToUser(memberId, "newMessage", populatedMessage);
        });

        res.json({ success: true, newMessage: populatedMessage });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};
