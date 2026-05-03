// backend/models/File.js
import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
  uploaderName: {
    type: String,
    required: true,
    trim: true,
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
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 172800 }, // Auto-deletes document in exactly 2 days
  },
});

export const File = mongoose.model("File", fileSchema);
