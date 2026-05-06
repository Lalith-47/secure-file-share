// backend/models/File.js
import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  fileFormat: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true, // Stored in bytes
  },
  s3Key: {
    type: String,
    required: true,
    unique: true,
  },
  sharingToken: {
    type: String,
    required: true,
    unique: true,
    index: true, // Highly efficient for fast lookups
  },
  targetEmail: {
    type: String,
    required: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  downloadedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 172800 }, // Auto-deletes document in exactly 2 days
  },
});

export const File = mongoose.model("File", fileSchema);
