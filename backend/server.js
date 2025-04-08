// server.js (Node.js with Express)
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { YoutubeTranscript } = require('youtube-transcript');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-pro-002";

// Endpoint to get YouTube transcript
app.get('/transcript', async (req, res) => {
  try {
    const { videoId } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ error: "Video ID is required" });
    }
    
    // Fetch transcript using youtube-transcript package
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = transcriptArray.map(item => item.text).join(' ');
    
    res.json({ transcript });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: "Failed to fetch transcript" });
  }
});

// Endpoint to generate summary using Gemini API
app.post('/summarize', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: "Transcript is required" });
    }
    
    // Make request to Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        contents: [{
          parts: [{
            text: `Please provide a concise summary of the following video transcript. Focus on the main points and key takeaways:\n\n${transcript}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        }
      }
    );
    
    const summary = response.data.candidates[0].content.parts[0].text;
    res.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok' });
});