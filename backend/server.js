const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { YoutubeTranscript } = require('youtube-transcript');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cors());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-pro-002";

app.get('/transcript', async (req, res) => {
  try {
    const { videoId } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ error: "Video ID is required" });
    }

    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);

    const processedTranscript = transcriptArray.map(item => {
      const timestamp = formatTimestampFromSeconds(item.offset / 1000);
      return {
        text: item.text,
        timestamp: timestamp
      };
    });
    
    const plainTranscript = transcriptArray.map(item => item.text).join(' ');
    

    res.json({ 
      transcript: plainTranscript,
      timestampedTranscript: processedTranscript 
    });
    console.log("Transcript response sent"); // Debug log
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: "Failed to fetch transcript" });
  }
});


function formatTimestampFromSeconds(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

app.post('/summarize', async (req, res) => {
  console.log("Received POST request to summarize"); // Debug log
  try {
    const { transcript, videoTitle, isQuestion, existingTimestamps } = req.body;
    console.log("Video Title:", videoTitle); // Debug log

    
    if (!transcript) {
      return res.status(400).json({ error: "Transcript is required" });
    }
    
    let prompt = `
      You are a summarization expert. I need a **structured summary** of a YouTube video based on the transcript provided.

      **Format your response EXACTLY as follows:**

      ---

      1. **TITLE:**  
      A short and clear title that captures the main topic of the video.

      2. **SUMMARY POINTS (8-12 total):**  
      Summarize the core ideas and insights from the video.  
      Each bullet should express one distinct, complete thought. Be concise and informative.

      - [Key idea or insight #1]  
      - [Key idea or insight #2]  
      - …  
      - [Key idea or insight #8-12]

      3. **HIGHLIGHTS (with timestamps):**  
      Select **10-15 key moments** that span the **entire video duration**.

      **Coverage & Distribution Rules (100% coverage):**
      - Use **real timestamps** based on the transcript, not fabricated ones.
      - Your first highlight should occur within the **first 5%** of the video.  
      - Your last highlight should be within the **final 5%** of the video.  
      - The remaining highlights must be **evenly distributed** across the rest of the timeline.
      - Do **not** cluster highlights in just one section.
      - Each timestamp must be matched with a **clear, specific description** of what is being said or discussed.

      **Quality Requirements:**
      - Each timestamp must **accurately match** the described moment in the transcript.  
      - Highlights must reflect real events, quotes, or key insights — avoid vague or generalized descriptions.

      Then list your highlights:

      - [MM:SS] - [Brief but precise description of what is discussed or shown at this moment]  
      - [MM:SS] - […]  
      - … (10-15 total)

      ---

      4. **ANSWER TO TITLE QUESTION:** *(only if the title is a question)*  
      Provide a clear, well-supported answer from the video and its timestamp:

      Answer: [Your answer here]  
      Timestamp: [MM:SS] - [Moment the answer appears]

      ---

      **Video Title:** “${videoTitle}”  
      **Transcript:**  
      ${transcript}

      *Note:* If the video description already has timestamps, you may use them—just verify they match the transcript and your descriptions exactly.
      `;

    if (isQuestion) {
      prompt += `
        4. ANSWER TO TITLE QUESTION:
        [Direct answer to the question in the title]
        [MM:SS] - [Timestamp where this answer is found]
        `;
    }

    if (existingTimestamps && existingTimestamps.length > 0) {
      prompt += `\nThe video already contains these timestamps in its description. Please incorporate them into your highlights when relevant:\n`;
      existingTimestamps.forEach(ts => {
        prompt += `- ${ts.time} - ${ts.description}\n`;
      });
    }

    prompt += `\nVideo Title: "${videoTitle}"\n\nHere's the transcript:\n\n${transcript}\n\nRemember to include timestamp and description for each highlight, formatted exactly as "MM:SS - Description".`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        }
      }
    );
    
    const rawResponse = response.data.candidates[0].content.parts[0].text;
    console.log("Raw Gemini response:", rawResponse); // Debug log
    
    const structuredData = parseStructuredResponse(rawResponse, isQuestion);
    console.log("Parsed structured data:", JSON.stringify(structuredData, null, 2)); // Debug log
    
    res.json(structuredData);
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

function parseStructuredResponse(response, isQuestion) {
  const structuredData = {
    title: "",
    summaryPoints: [],
    highlights: [],
    answer: null,
    answerTimestamp: null
  };
  
  try {
    const titleMatch = response.match(/TITLE:?\s*\n?(.*?)(?=\n\s*\d+\.|$)/s);
    if (titleMatch && titleMatch[1]) {
      structuredData.title = titleMatch[1].trim();
    }
    
    const summaryMatch = response.match(/SUMMARY POINTS:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|$)/s);
    if (summaryMatch && summaryMatch[1]) {
      const points = summaryMatch[1].split('\n').filter(line => 
        line.trim().startsWith('-') || line.trim().startsWith('•')
      );
      structuredData.summaryPoints = points.map(point => 
        point.replace(/^[-•]\s*/, '').trim()
      );
    }
    
    const highlightsMatch = response.match(/HIGHLIGHTS:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|$)/s);
    if (highlightsMatch && highlightsMatch[1]) {
      const highlightLines = highlightsMatch[1].split('\n').filter(line => 
        (line.trim().startsWith('-') || line.trim().startsWith('•')) && 
        /\d+:\d+/.test(line) // Contains a timestamp
      );
      
      highlightLines.forEach(line => {
        const highlightMatch = line.match(/(\d+:\d+(?::\d+)?)\s*-\s*(.*)/);
        if (highlightMatch) {
          const timestamp = highlightMatch[1].trim();
          const description = highlightMatch[2].trim();
          
          structuredData.highlights.push({
            timestamp,
            description
          });
        }
      });
    }
    
    if (isQuestion) {
      const answerMatch = response.match(/ANSWER TO TITLE QUESTION:?\s*\n?([\s\S]*?)(?=\n\s*\d+\.|$)/s);
      if (answerMatch && answerMatch[1]) {
        const answerLines = answerMatch[1].split('\n').filter(line => line.trim());
        
        if (answerLines.length > 0) {
          const answerLine = answerLines.find(line => 
            !line.match(/^\d+:\d+/) && 
            !line.toLowerCase().includes('answer to title question:')
          );
          
          if (answerLine) {
            structuredData.answer = answerLine.replace(/^[-•]\s*/, '').trim();
          }
          
          const timestampMatch = answerMatch[1].match(/(\d+:\d+(?::\d+)?)/);
          if (timestampMatch) {
            structuredData.answerTimestamp = timestampMatch[1];
          }
        }
      }
    }
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
  }
  
  structuredData.highlights = structuredData.highlights.filter(h => 
    h.timestamp && h.description
  );
  
  return structuredData;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok' });
});