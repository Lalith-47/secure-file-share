// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  googleId: String,
  githubId: String,
  displayName: String,
  email: String,
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);
