# Ephemeral File Share 🚀

A high-performance, decoupled, ephemeral file-sharing application. Files are uploaded directly to AWS S3 using pre-signed URLs, avoiding backend bottlenecks. The backend handles metadata, security, and tokenized access.

---

## 🏗 System Architecture

```
Client → Express API → S3 (direct upload)
                ↓
           MongoDB Atlas
```

### Flow

1. Client requests a pre-signed upload URL.
2. Client uploads file directly to S3.
3. Backend stores metadata + generates secure access token.

---

## 🛠 Tech Stack

### Frontend

- HTML5, CSS3 (Glassmorphism UI)
- Fetch API
- Hosted on Render Static Sites
- Cloudflare for DNS + SSL

### Backend

- Node.js (ES Modules)
- Express
- MongoDB Atlas (via Mongoose)
- AWS S3 (SDK v3)
- Hosted on Render

---

## 📁 Project Structure

```
secure-file-share/
├── backend/
│   ├── models/
│   │   └── File.js
│   ├── .env
│   ├── package.json
│   └── server.js
├── frontend/
│   └── index.html
└── .gitignore
```

---

## ⚙️ Local Setup

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB Atlas URI
- AWS IAM credentials

---

### Backend Setup

```bash
cd backend
npm install
```

Create `.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
AWS_REGION=ap-south-1
AWS_BUCKET_NAME=your_bucket
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

Run backend:

```bash
npm run dev
```

---

### Frontend Setup

Update API endpoint:

```js
const API = "http://localhost:5000/api";
```

Serve frontend:

```bash
cd frontend
npx serve -l 3000
```

---

## ☁️ Deployment

### Backend (Render)

- Root Directory: `backend`
- Build: `npm install`
- Start: `node server.js`
- Add all `.env` variables in Render dashboard

---

### Frontend (Render Static Site)

- Root Directory: `frontend`
- Publish Directory: `.`
- No build command needed

Update API:

```js
const API = "https://secure-file-share-qr49.onrender.com/api";
```

---

### Custom Domain (Cloudflare)

- Add CNAME:
  - Name: `share`
  - Target: your-render-url

- Set **DNS Only** initially for SSL issuance

---

## 🔌 API Endpoints

### GET `/api/upload-url`

Get pre-signed S3 upload URL

**Query:**

- fileName
- fileType

**Response:**

```json
{
  "uploadUrl": "https://...",
  "s3Key": "uploads/filename"
}
```

---

### POST `/api/files`

Store metadata + generate file ID

**Body:**

```json
{
  "uploaderName": "Lalith",
  "fileName": "file.pdf",
  "fileFormat": "application/pdf",
  "fileSize": 12345,
  "s3Key": "uploads/file"
}
```

---

### GET `/api/download/:fileId`

Retrieve download link

**Response:**

```json
{
  "fileName": "file.pdf",
  "fileSize": 12345,
  "uploaderName": "Lalith",
  "downloadUrl": "https://..."
}
```

---

## ⚡ Key Design Decisions

- Direct S3 upload avoids backend load
- Stateless backend for scalability
- Token-based retrieval instead of exposing raw S3 paths
- Fully decoupled frontend + backend

---

## 📌 Notes

- MongoDB network access must allow external connections (Render uses dynamic IPs)
- Never commit `.env`
- Use HTTPS in production

---

## 🧠 Summary

This project is designed for:

- **Efficiency**: no file buffering in backend
- **Scalability**: stateless + cloud-native
- **Security**: pre-signed URLs + tokenized access

---

## 🏁 Status

Production-ready ✔
