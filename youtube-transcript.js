// youtube-transcript.js - Lightweight transcript extraction
class YouTubeTranscript {
    constructor() {
      this.baseUrl = 'https://www.youtube.com';
    }
  
    // Main function to fetch transcript
    async fetchTranscript(videoId) {
      try {
        // Try to extract transcript from the current page first
        const inPageTranscript = await this.extractTranscriptFromPage();
        if (inPageTranscript) {
          return inPageTranscript;
        }
        
        // If that fails, try fetching the transcript using YouTube's hidden API
        return await this.fetchTranscriptFromApi(videoId);
      } catch (error) {
        console.error('Error fetching transcript:', error);
        throw new Error('Failed to fetch transcript. This video might not have captions available.');
      }
    }
  
    // Extract transcript directly from the page if available
    async extractTranscriptFromPage() {
      // Look for transcript text in the page
      const transcriptElements = document.querySelectorAll('.ytd-transcript-segment-renderer');
      if (transcriptElements.length > 0) {
        const transcriptText = Array.from(transcriptElements)
          .map(element => element.textContent.trim())
          .join(' ');
        
        return transcriptText;
      }
      
      return null;
    }
  
    // Fetch transcript using YouTube's AJAX API
    async fetchTranscriptFromApi(videoId) {
      try {
        // Get the current page's captions track URL
        const response = await fetch(`${this.baseUrl}/watch?v=${videoId}&gl=US`);
        const html = await response.text();
        
        // Extract player config from page
        const playerConfigMatch = html.match(/"playerConfig":(.+?),"miniplayer/);
        if (!playerConfigMatch) {
          throw new Error('Could not find player config');
        }
        
        // Parse the JSON config
        let playerConfig;
        try {
          playerConfig = JSON.parse(playerConfigMatch[1]);
        } catch (e) {
          throw new Error('Failed to parse player config');
        }
        
        // Extract captions track URL
        const captionsTrack = this.findCaptionsTrack(playerConfig);
        if (!captionsTrack) {
          throw new Error('No captions track found for this video');
        }
        
        // Fetch the captions track
        const captionsResponse = await fetch(captionsTrack);
        const captionsXml = await captionsResponse.text();
        
        // Parse the XML and extract text
        return this.parseCaptionsXml(captionsXml);
      } catch (error) {
        console.error('Error in fetchTranscriptFromApi:', error);
        
        // Fallback method - try to extract from video info
        return this.extractFromVideoInfo(videoId);
      }
    }
    
    // Try to extract transcript from video info
    async extractFromVideoInfo(videoId) {
      // This is a simplified method - in a real extension,
      // you'd need more robust parsing of YouTube's data
      const videoInfoUrl = `${this.baseUrl}/get_video_info?video_id=${videoId}`;
      
      try {
        const response = await fetch(videoInfoUrl);
        const data = await response.text();
        
        // Parse the response and extract caption tracks
        const params = new URLSearchParams(data);
        const playerResponse = JSON.parse(params.get('player_response') || '{}');
        
        const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (!captionTracks || captionTracks.length === 0) {
          throw new Error('No caption tracks found');
        }
        
        // Use the first available track (usually the default one)
        const captionTrack = captionTracks[0];
        const captionUrl = captionTrack.baseUrl;
        
        const captionsResponse = await fetch(captionUrl);
        const captionsXml = await captionsResponse.text();
        
        return this.parseCaptionsXml(captionsXml);
      } catch (error) {
        console.error('Error extracting from video info:', error);
        throw new Error('Failed to extract transcript');
      }
    }
    
    // Find captions track in player config
    findCaptionsTrack(playerConfig) {
      try {
        const captions = playerConfig?.captions;
        if (!captions) return null;
        
        const captionTracks = captions.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captionTracks || captionTracks.length === 0) return null;
        
        // Use the first available track (usually the default one)
        return captionTracks[0].baseUrl;
      } catch (error) {
        console.error('Error finding captions track:', error);
        return null;
      }
    }
    
    // Parse captions XML format
    parseCaptionsXml(xml) {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, 'text/xml');
        
        // Extract text nodes
        const textNodes = xmlDoc.getElementsByTagName('text');
        
        // Convert to transcript text
        let transcriptText = '';
        for (let i = 0; i < textNodes.length; i++) {
          transcriptText += ' ' + (textNodes[i].textContent || '');
        }
        
        return transcriptText.trim();
      } catch (error) {
        console.error('Error parsing captions XML:', error);
        throw new Error('Failed to parse captions');
      }
    }
  }
  
  // Create global instance
  window.YouTubeTranscript = new YouTubeTranscript();