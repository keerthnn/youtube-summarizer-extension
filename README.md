# YouTube Summarizer Extension

A Chrome extension that summarizes YouTube videos using the Gemini API by extracting video transcripts and generating concise summaries.

---

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/keerthnn/youtube-summarizer-extension.git
cd youtube-summarizer-extension
```

---

### 2. Create a `.env` File

Inside the `backend` folder, create a `.env` file and add your Gemini API key:

```env
# backend/.env
GEMINI_API_KEY=your_api_key_here
```

---

### 3. Install Backend Dependencies

```bash
cd backend
npm install express cors axios youtube-transcript dotenv
```

---

### 4. Start the Backend Server

```bash
node server.js
```

---

##  Chrome Extension Setup

### 1. Build or Download the Extension

Ensure your extension files (e.g., `manifest.json`, `popup.html`, `popup.js`, etc.) are ready in the `extension/` folder.

### 2. Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the folder where your extension files are located (e.g., `extension/`)

### 3. Use the Extension

- Navigate to any YouTube video
- Click the extension icon in the toolbar
- Click the **"Summarize"** button to get a summary of the video

---

Make sure the backend server is running (`node backend/server.js`) before using the extension.




