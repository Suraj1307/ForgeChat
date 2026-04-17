import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["text", "image", "pdf", "docx"],
      default: "text",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      default: "text/plain",
    },
    textContent: {
      type: String,
      default: "",
    },
    fileData: {
      type: String,
      default: "",
    },
    previewUrl: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  attachments: {
    type: [AttachmentSchema],
    default: [],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ThreadSchema = new mongoose.Schema(
  {
    threadId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
      trim: true,
    },
    messages: [MessageSchema],
  },
  {
    timestamps: true,
  }
);

ThreadSchema.index({ userId: 1, threadId: 1 }, { unique: true });

export default mongoose.model("Thread", ThreadSchema);
