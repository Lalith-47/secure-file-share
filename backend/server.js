// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import crypto from "crypto";
import session from "express-session";
import passport from "passport";
import "./config/passport.js"; // Initialize passport strategies


import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { File } from "./models/File.js";

dotenv.config();

// Initialize passport strategies (loads env inside module)
import "./config/passport.js";

const app = express();
const clientUrl = process.env.CLIENT_URL || "http://localhost:5500";

app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json());

if (!process.env.SESSION_SECRET) {
  console.warn(
    "[WARN] SESSION_SECRET is not set. Set it in backend/.env for secure sessions.",
  );
}

app.set("trust proxy", 1); // Trust Render proxy for secure cookies

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-insecure-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});
// Health check route
app.get("/", (req, res) => {
  res.send("Secure File Share API is running successfully!");
});

// 1. Establish strict MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Successfully connected to MongoDB Atlas."))
  .catch((err) => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });

// 2. Initialize AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// --- Auth Routes ---
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${clientUrl}/?auth=failed`,
  }),
  (req, res) => {
    res.redirect(clientUrl);
  },
);

app.get(
  "/api/auth/github",
  passport.authenticate("github", { scope: ["user:email"] }),
);

app.get(
  "/api/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: `${clientUrl}/?auth=failed`,
  }),
  (req, res) => {
    res.redirect(clientUrl);
  },
);

app.get("/api/auth/status", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ isAuthenticated: true, user: req.user });
  } else {
    res.json({ isAuthenticated: false });
  }
});

app.get("/api/auth/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session?.destroy(() => {
      res.redirect(clientUrl);
    });
  });
});
// -------------------

// Route A: Request Upload URL from S3
app.get("/api/upload-url", async (req, res) => {
  const { fileName, fileType } = req.query;
  if (!fileName || !fileType) {
    return res
      .status(400)
      .json({ error: "fileName and fileType parameters are required." });
  }

  // File structure logic
  const s3Key = `uploads/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: s3Key,
    ContentType: fileType,
  });

  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // Valid for 15 minutes
    res.status(200).json({ uploadUrl, s3Key });
  } catch (error) {
    console.error("Presigned URL error:", error);
    res.status(500).json({ error: "Failed to generate upload URL." });
  }
});

// Route B: Confirm Upload and save Metadata with secure token
app.post("/api/files", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  const { fileName, fileFormat, fileSize, s3Key, targetEmail } = req.body;
  if (!fileName || !fileFormat || !fileSize || !s3Key || !targetEmail) {
    return res.status(400).json({ error: "Incomplete metadata payload." });
  }

  try {
    // Generate a cryptographically secure 16-byte random hex string
    const sharingToken = crypto.randomBytes(16).toString("hex");

    const fileDoc = await File.create({
      uploadedBy: req.user._id,
      fileName,
      fileFormat,
      fileSize,
      s3Key,
      sharingToken, // Persisting secure identifier
      targetEmail,
    });

    // Return the secure random token to the frontend instead of raw _id
    res.status(201).json({ fileId: fileDoc.sharingToken });
  } catch (error) {
    console.error("DB Save Error:", error);
    res.status(500).json({ error: "Could not persist metadata." });
  }
});

// Route C: Request Secure Download URL using the random token
app.get("/api/download/:fileId", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized. Please log in to download." });
  }

  const { fileId } = req.params; // This matches the sharingToken

  try {
    // First, find the file to verify the user
    let file = await File.findOne({ sharingToken: fileId }).populate("uploadedBy");
    if (!file) {
      return res.status(404).json({ error: "File does not exist." });
    }
    
    // Verify target user
    if (file.targetEmail !== req.user.email) {
      return res.status(403).json({ error: "Access denied. You are not authorized to access this file." });
    }

    if (file.isUsed) {
      return res.status(410).json({ error: "This link has already been used and is expired." });
    }

    // Atomically "burn" the link to guarantee one-time use even with concurrent requests.
    const burnedAt = new Date();
    file = await File.findOneAndUpdate(
      { sharingToken: fileId, isUsed: false },
      { $set: { isUsed: true, downloadedAt: burnedAt } },
      { new: true },
    ).populate("uploadedBy");

    if (!file) {
      return res.status(410).json({ error: "This link has already been used and is expired." });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: file.s3Key,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // Valid for 1 hour

    res.status(200).json({
      downloadUrl,
      fileName: file.fileName,
      fileSize: file.fileSize,
      uploaderName: file.uploadedBy ? file.uploadedBy.displayName : "Unknown",
    });
  } catch (error) {
    console.error("S3 Get Error:", error);
    res.status(500).json({ error: "Internal error processing download link." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend service live on port ${PORT}`));
