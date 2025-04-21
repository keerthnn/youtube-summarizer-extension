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
const GEMINI_MODEL = "gemini-2.0-flash";

app.get('/transcript', async (req, res) => {
  try {
    const { videoId } = req.query;

    if (!videoId) {
      return res.status(400).json({ error: "Video ID is required" });
    }

    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);

    const plainTranscript = transcriptArray.map(item => item.text).join(' ');
    
    const duration = transcriptArray.reduce((max, item) => {
      const end = item.offset + (item.duration || 0);
      return end > max ? end : max;
    }, 0);    

    console.log("Duration:", duration);
    
    const lang = transcriptArray.length > 0 && transcriptArray[0].language ? 
      transcriptArray[0].language : 'en';

    res.json({
      transcript: plainTranscript,
      timestampedTranscript: transcriptArray,
      duration: duration,
      lang: lang
    });

    console.log("Transcript response sent");
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: "Failed to fetch transcript" });
  }
});

app.post('/summarize', async (req, res) => {
  console.log("Received POST request to summarize"); 
  try {
    const { transcript, videoTitle, existingTimestamps, duration, lang, timestampedTranscript } = req.body;
    console.log("Video Title:", videoTitle);
    console.log("Video Duration:", duration, "seconds");
    
    if (!transcript) {
      return res.status(400).json({ error: "Transcript is required" });
    }
    
    const videoDuration = duration || Math.ceil(transcript.split(/\s+/).length / 150) * 60;
    
    const timestampReferences = [];
    if (timestampedTranscript && timestampedTranscript.length > 0) {
      const interval = Math.floor(timestampedTranscript.length / 15);
      for (let i = 0; i < timestampedTranscript.length; i += interval) {
        if (i < timestampedTranscript.length) {
          const item = timestampedTranscript[i];
          timestampReferences.push({
            time: formatTimestamp(item.offset),
            text: item.text.substring(0, 50) + (item.text.length > 50 ? '...' : '')
          });
        }
      }
    }
    
    let prompt = `
      You are a summarization expert. I need a **structured summary** of a YouTube video based on the transcript provided.

      **Format your response EXACTLY as follows:**

      ---

      1. **SUMMARY POINTS (8-12 total):**  
      Summarize the core ideas and insights from the video.  
      Each bullet should express one distinct, complete thought. Be concise and informative.

      - [Key idea or insight #1]  
      - [Key idea or insight #2]  
      - …  
      - [Key idea or insight #8-12]

      2. **HIGHLIGHTS (with timestamps):**  
      Select **exactly 10-12 key moments** that span the **entire video duration**. This is CRITICAL.

      **MANDATORY Coverage & Distribution Rules (100% coverage):**
      - Use **real timestamps** based on the transcript data I'm providing.
      - Your first highlight MUST occur within the **first 10%** of the video.  
      - Your last highlight MUST be within the **final 10%** of the video.  
      - The remaining highlights MUST be **evenly distributed** across the rest of the timeline.
      - Each timestamp must be matched with a **clear, specific description** of what is being said or discussed.
      - The video is exactly ${Math.ceil(videoDuration/60)} minutes long (${formatTimestamp(videoDuration)}).
      - DO NOT generate timestamps beyond ${formatTimestamp(videoDuration)}.

      **Quality Requirements:**
      - ONLY use timestamps that actually exist in the transcript.
      - Highlights must reflect real events, quotes, or key insights — avoid vague or generalized descriptions.
      - Each timestamp should correspond to something specifically said at that moment.

      Then list your highlights:

      - [MM:SS] - [Brief but precise description of what is discussed or shown at this moment]  
      - [MM:SS] - […]  
      - … (10-12 total, evenly distributed)

      ---

      **Video Title:** "${videoTitle}"  
      **Video Duration:** ${formatTimestamp(videoDuration)}
    `;

    if (timestampReferences.length > 0) {
      prompt += `\n\n**Available Timestamp Reference Points:**\n`;
      timestampReferences.forEach(ref => {
        prompt += `- ${ref.time} - "${ref.text}"\n`;
      });
      prompt += `\nUse ONLY these timestamps or times very close to them in your highlights.`;
    }

    if (existingTimestamps && existingTimestamps.length > 0) {
      prompt += `\n\nThe video already contains these timestamps in its description. Please incorporate them into your highlights when relevant:\n`;
      existingTimestamps.forEach(ts => {
        prompt += `- ${ts.time} - ${ts.description}\n`;
      });
    }

    prompt += `\n\n**Transcript:**\n${transcript}\n\nRemember to include timestamp and description for each highlight, formatted exactly as "MM:SS - Description". Your highlights MUST be within the video duration of ${formatTimestamp(videoDuration)}.`;

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
    console.log("Raw Gemini response:", rawResponse); 
    
    const structuredData = parseStructuredResponse(rawResponse, videoDuration);
    console.log("Parsed structured data:", JSON.stringify(structuredData, null, 2)); 
    
    res.json(structuredData);
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

function parseStructuredResponse(response, videoDuration) {
  const structuredData = {
    title: "",
    summaryPoints: [],
    highlights: []
  };
  
  try {
    const titleMatch = response.match(/TITLE:?\s*\n?(.*?)(?=\n\s*\d+\.|$)/s);
    if (titleMatch && titleMatch[1]) {
      structuredData.title = titleMatch[1].replace(/\*\*/g, '').trim();
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
        /\d+:\d+/.test(line) 
      );
      
      highlightLines.forEach(line => {
        const highlightMatch = line.match(/(\d+:\d+(?::\d+)?)\s*-\s*(.*)/);
        if (highlightMatch) {
          const timestamp = highlightMatch[1].trim();
          const description = highlightMatch[2].trim();
          
          const timeInSeconds = convertTimestampToSeconds(timestamp);

          if (timeInSeconds <= videoDuration) {
            structuredData.highlights.push({
              timestamp,
              description
            });
          }
        }
      });
      
      if (videoDuration && structuredData.highlights.length > 0) {
        const firstTimestampSeconds = convertTimestampToSeconds(structuredData.highlights[0].timestamp);
        const lastTimestampSeconds = convertTimestampToSeconds(structuredData.highlights[structuredData.highlights.length - 1].timestamp);
        
        if (firstTimestampSeconds > videoDuration * 0.05) {
          const earlyTimestamp = formatTimestamp(Math.floor(videoDuration * 0.03));
          structuredData.highlights.unshift({
            timestamp: earlyTimestamp,
            description: "Video introduction"
          });
        }
        
        if (lastTimestampSeconds < videoDuration * 0.95) {
          const lateTimestamp = formatTimestamp(Math.floor(videoDuration * 0.97));
          structuredData.highlights.push({
            timestamp: lateTimestamp,
            description: "Video conclusion"
          });
        }
        
        const targetHighlightCount = 12;
        if (structuredData.highlights.length < targetHighlightCount) {
          const currentHighlights = [...structuredData.highlights];
          const newHighlights = [];
          
          currentHighlights.sort((a, b) => {
            return convertTimestampToSeconds(a.timestamp) - convertTimestampToSeconds(b.timestamp);
          });
          
          for (let i = 0; i < currentHighlights.length - 1; i++) {
            const currentSeconds = convertTimestampToSeconds(currentHighlights[i].timestamp);
            const nextSeconds = convertTimestampToSeconds(currentHighlights[i + 1].timestamp);
            const gap = nextSeconds - currentSeconds;
            
            if (gap > videoDuration / targetHighlightCount * 2) { 
              const numIntermediatePoints = Math.floor(gap / (videoDuration / targetHighlightCount)) - 1;
              for (let j = 1; j <= numIntermediatePoints; j++) {
                const intermediateSeconds = currentSeconds + gap * j / (numIntermediatePoints + 1);
                newHighlights.push({
                  timestamp: formatTimestamp(Math.floor(intermediateSeconds)),
                  description: `Key point at ${formatTimestamp(Math.floor(intermediateSeconds))}`
                });
              }
            }
          }
          
          structuredData.highlights = [...currentHighlights, ...newHighlights].sort((a, b) => {
            return convertTimestampToSeconds(a.timestamp) - convertTimestampToSeconds(b.timestamp);
          });
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

function convertTimestampToSeconds(timestamp) {
  const parts = timestamp.split(':').map(Number);
  
  if (parts.length === 3) { 
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) { 
    return parts[0] * 60 + parts[1];
  } else {
    return parts[0];
  }
}

function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok' });
});