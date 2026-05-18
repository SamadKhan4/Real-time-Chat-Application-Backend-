import mongoose from "mongoose";

const contactRequestSchema = new mongoose.Schema({
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
        type: String,
        enum: ["pending", "accepted", "declined"],
        default: "pending",
    },
}, { timestamps: true });

contactRequestSchema.index(
    { requester: 1, recipient: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "pending" },
    }
);

const ContactRequest = mongoose.model("ContactRequest", contactRequestSchema);

export default ContactRequest;
