class YouTubeTranscript {
  constructor() {
    this.baseUrl = 'https://www.youtube.com';
  }

async fetchTranscript(videoId) {
    try {        
      const inPageTranscript = await this.extractTranscriptFromPage();
      if (inPageTranscript) {
        return inPageTranscript;
      }
      
      return await this.fetchTranscriptFromApi(videoId);
    } catch (error) {
      console.error('Error fetching transcript:', error);
      throw new Error('Failed to fetch transcript. This video might not have captions available.');
    }
  }

  async extractTranscriptFromPage() {
    const transcriptElements = document.querySelectorAll('.ytd-transcript-segment-renderer');
    if (transcriptElements.length > 0) {
      const transcriptText = Array.from(transcriptElements)
        .map(element => element.textContent.trim())
        .join(' ');
      
      return transcriptText;
    }
    
    return null;
  }

  async fetchTranscriptFromApi(videoId) {
    try {
      const response = await fetch(`${this.baseUrl}/watch?v=${videoId}&gl=US`);
      const html = await response.text();
      
      const playerConfigMatch = html.match(/"playerConfig":(.+?),"miniplayer/);
      if (!playerConfigMatch) {
        throw new Error('Could not find player config');
      }
      
      let playerConfig;
      try {
        playerConfig = JSON.parse(playerConfigMatch[1]);
      } catch (e) {
        throw new Error('Failed to parse player config');
      }
      
      const captionsTrack = this.findCaptionsTrack(playerConfig);
      if (!captionsTrack) {
        throw new Error('No captions track found for this video');
      }
      
      const captionsResponse = await fetch(captionsTrack);
      const captionsXml = await captionsResponse.text();
      
      return this.parseCaptionsXml(captionsXml);
    } catch (error) {
      console.error('Error in fetchTranscriptFromApi:', error);
      
      return this.extractFromVideoInfo(videoId);
    }
  }
  
  async extractFromVideoInfo(videoId) {
    const videoInfoUrl = `${this.baseUrl}/get_video_info?video_id=${videoId}`;
    
    try {
      const response = await fetch(videoInfoUrl);
      const data = await response.text();
      
      const params = new URLSearchParams(data);
      const playerResponse = JSON.parse(params.get('player_response') || '{}');
      
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      
      if (!captionTracks || captionTracks.length === 0) {
        throw new Error('No caption tracks found');
      }
      
      const captionTrack = captionTracks[0];
      const captionUrl = captionTrack.baseUrl;
      const language = captionTrack.languageCode || 'en';
      
      const captionsResponse = await fetch(captionUrl);
      const captionsXml = await captionsResponse.text();
      
      return this.parseCaptionsXml(captionsXml, language);
    } catch (error) {
      console.error('Error extracting from video info:', error);
      throw new Error('Failed to extract transcript');
    }
  }
  
  findCaptionsTrack(playerConfig) {
    try {
      const captions = playerConfig?.captions;
      if (!captions) return null;
      
      const captionTracks = captions.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) return null;
      
      return captionTracks[0].baseUrl;
    } catch (error) {
      console.error('Error finding captions track:', error);
      return null;
    }
  }
  
  parseCaptionsXml(xml, lang = 'en') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');
      const textNodes = xmlDoc.getElementsByTagName('text');
  
      const transcript = [];
      let totalDuration = 0;
  
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        const text = node.textContent || '';
        const start = parseFloat(node.getAttribute('start') || '0');
        const duration = parseFloat(node.getAttribute('dur') || '0');
        const timestamp = formatTimestamp(start);
        
        transcript.push({
          text: text.trim(),
          startSeconds: start,
          timestamp: timestamp,
          duration: duration,
          offset: start,
          language: lang
        });
        
        totalDuration = Math.max(totalDuration, start + duration);
      }
      
      if (transcript.length > 0) {
        transcript[transcript.length - 1].totalDuration = totalDuration;
      }
  
      return transcript;
    } catch (error) {
      console.error('Error parsing captions XML:', error);
      throw new Error('Failed to parse captions');
    }
  }
}

window.YouTubeTranscript = new YouTubeTranscript();