// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { File } from "./models/File.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
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

// Route B: Confirm Upload and save Metadata
app.post("/api/files", async (req, res) => {
  const { uploaderName, fileName, fileFormat, fileSize, s3Key } = req.body;
  if (!uploaderName || !fileName || !fileFormat || !fileSize || !s3Key) {
    return res.status(400).json({ error: "Incomplete metadata payload." });
  }

  try {
    const fileDoc = await File.create({
      uploaderName,
      fileName,
      fileFormat,
      fileSize,
      s3Key,
    });

    res.status(201).json({ fileId: fileDoc._id });
  } catch (error) {
    console.error("DB Save Error:", error);
    res.status(500).json({ error: "Could not persist metadata." });
  }
});

// Route C: Request Secure Download URL from S3
app.get("/api/download/:fileId", async (req, res) => {
  const { fileId } = req.params;

  try {
    const file = await File.findById(fileId);
    if (!file) {
      return res
        .status(404)
        .json({ error: "Link has expired or file does not exist." });
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
      uploaderName: file.uploaderName,
    });
  } catch (error) {
    console.error("S3 Get Error:", error);
    res.status(500).json({ error: "Internal error processing download link." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend service live on port ${PORT}`));
