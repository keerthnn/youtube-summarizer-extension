function waitForSidebarAndInject() {
  const sidebar = document.getElementById('secondary');
  if (sidebar) {
    injectSummarizerUI();
  } else {
    setTimeout(waitForSidebarAndInject, 300);
  }
}

window.addEventListener('load', () => {
  if (window.location.pathname.includes('/watch')) {
    waitForSidebarAndInject();
  }
});

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (window.location.pathname.includes('/watch')) {
      waitForSidebarAndInject();
      
      const content = document.querySelector('.summarizer-content');
      if (content) {
        content.innerHTML = `<p class="summarizer-placeholder">Click "Summarize Video" to get summary</p>`;
      }
    }
  }
}).observe(document, { subtree: true, childList: true });

function injectSummarizerUI() {
  setTimeout(() => {
    let summarizer = document.getElementById('video-summarizer');
    
    if (summarizer) {
      summarizer.classList.remove('summarizer-minimized');
      return;
    }
    
    summarizer = document.createElement('div');
    summarizer.id = 'video-summarizer';
    summarizer.classList.add('summarizer-container');

    const header = document.createElement('div');
    header.classList.add('summarizer-header');

    const name = document.createElement('div');
    name.classList.add('summarizer-name');
    name.textContent = 'Video Summary';

    const controls = document.createElement('div');
    controls.classList.add('summarizer-controls');
    
    const actionButtons = `
      <button class="summarizer-control-btn" title="Close"><span>Close</span></button>
    `;
    controls.innerHTML = actionButtons;

    const closeButton = controls.querySelector('button:last-child');
    closeButton.addEventListener('click', () => {
      summarizer.classList.add('summarizer-minimized');
      showMinimizedButton();
    });

    header.appendChild(name);
    header.appendChild(controls);

    const summarizeBtn = document.createElement('button');
    summarizeBtn.classList.add('summarizer-btn');
    summarizeBtn.textContent = 'Summarize';
    summarizeBtn.addEventListener('click', handleSummarize);

    const content = document.createElement('div');
    content.classList.add('summarizer-content');
    content.innerHTML = `<p class="summarizer-placeholder">Click "Summarize Video" to get summary</p>`;

    const footer = document.createElement('div');
    footer.classList.add('summarizer-footer');
    footer.innerHTML = `
      <button class="summarizer-share-btn">Copy</button>
    `;
    
    const shareBtn = footer.querySelector('.summarizer-share-btn');
    shareBtn.addEventListener('click', () => {
      const summary = document.querySelector('.summary-container')?.textContent;
      if (summary) {
        navigator.clipboard.writeText(summary)
          .then(() => {
            const originalText = shareBtn.textContent;
            shareBtn.textContent = 'Copied!';
            setTimeout(() => {
              shareBtn.textContent = originalText;
            }, 2000);
          })
          .catch(err => {
            console.error('Failed to copy summary:', err);
          });
      }
    });

    summarizer.appendChild(header);
    summarizer.appendChild(summarizeBtn);
    summarizer.appendChild(content);
    summarizer.appendChild(footer);

    const sidebar = document.getElementById('secondary');
    if (sidebar) {
      sidebar.prepend(summarizer);
    } else {
      document.body.appendChild(summarizer);
    }
  }, 1000); 
}

function getVideoTitle() {
  const possibleSelectors = [
    '#title h1 yt-formatted-string',
    '#title h1',
    '#title yt-formatted-string',
    'h1.title yt-formatted-string',
    'h1.title',
    '#above-the-fold #title'
  ];
  
  for (const selector of possibleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log("Found title with selector:", selector);
      return element.textContent.trim();
    }
  }
  
  console.log("Could not find video title with any selector");
  return "YouTube Video";
}

function showMinimizedButton() {
  let miniBox = document.getElementById('summarizer-mini-box');
  if (miniBox) return;

  miniBox = document.createElement('div');
  miniBox.id = 'summarizer-mini-box';
  miniBox.classList.add('summarizer-mini-box');

  miniBox.innerHTML = `
    <div class="mini-box-header">
      <span>Video Summary</span>
      <button class="restore-summary-btn">Show Summary</button>
    </div>
  `;

  miniBox.querySelector('.restore-summary-btn').addEventListener('click', () => {
    const summarizer = document.getElementById('video-summarizer');
    if (summarizer) {
      summarizer.classList.remove('summarizer-minimized');
      miniBox.remove(); 
    }
  });

  const sidebar = document.getElementById('secondary');
  if (sidebar) {
    sidebar.prepend(miniBox);
  }
}

function extractTimestampsFromDescription() {
  try {
    let fullDescription = '';
    
    const ytInitialData = window.ytInitialData || {};
    const playerResponse = window.ytInitialPlayerResponse || {};
    
    if (playerResponse.videoDetails && playerResponse.videoDetails.shortDescription) {
      fullDescription = playerResponse.videoDetails.shortDescription;
    } 
    else if (ytInitialData.contents?.twoColumnWatchNextResults?.results?.results?.contents) {
      const contents = ytInitialData.contents.twoColumnWatchNextResults.results.results.contents;
      
      for (const item of contents) {
        if (item.videoSecondaryInfoRenderer?.description?.runs) {
          fullDescription = item.videoSecondaryInfoRenderer.description.runs
            .map(run => run.text)
            .join('');
          break;
        }
        
        if (item.structuredDescriptionContentRenderer?.items) {
          const items = item.structuredDescriptionContentRenderer.items;
          for (const descItem of items) {
            if (descItem.videoDescriptionTextItem?.content) {
              fullDescription += descItem.videoDescriptionTextItem.content + "\n";
            }
          }
          if (fullDescription) break;
        }
      }
    }
    
    if (!fullDescription || !fullDescription.includes("Time Stamp") && !fullDescription.includes("Timestamps")) {
      const expandButton = document.querySelector('#expand') || 
                         document.querySelector('#more') ||
                         document.querySelector('tp-yt-paper-button#expand') ||
                         document.querySelector('button[aria-label="Show more"]');
      
      let wasCollapsed = false;
      if (expandButton && expandButton.offsetParent !== null) {
        wasCollapsed = true;
        expandButton.click();
        
        return new Promise(resolve => {
          setTimeout(() => {
            const result = extractDescriptionFromDOM();
            
            if (wasCollapsed) {
              const collapseButton = document.querySelector('#collapse') || 
                                   document.querySelector('tp-yt-paper-button#collapse') ||
                                   document.querySelector('button[aria-label="Show less"]');
              if (collapseButton) collapseButton.click();
            }
            
            resolve(result);
          }, 300); 
        });
      } else {
        return extractDescriptionFromDOM();
      }
    }
    
    return processDescription(fullDescription);
  } catch (error) {
    return extractDescriptionFromDOM();
  }
}

function extractDescriptionFromDOM() {
  const descriptionContainers = [
    document.querySelector('#description-inline-expander'),
    document.querySelector('ytd-text-inline-expander#description'),
    document.querySelector('#description'),
    document.querySelector('[itemprop="description"]'),
    document.querySelector('ytm-description-shelf-renderer'),
    document.querySelector('ytm-video-description-content-renderer')
  ].filter(Boolean);
  
  let fullText = '';
  
  for (const container of descriptionContainers) {
    const textContent = container.textContent || '';
    
    if (textContent.length > fullText.length) {
      fullText = textContent;
    }
    
    const allParagraphs = container.querySelectorAll('span, p, div');
    for (const para of allParagraphs) {
      const paraText = para.textContent || '';
      if ((paraText.includes('Time Stamp') || 
           paraText.includes('Timestamps') || 
           paraText.includes('00:0') || 
           paraText.includes('00:1')) && 
          paraText.length > 20) {
        return processDescription(paraText);
      }
    }
  }
  
  return processDescription(fullText);
}

function processDescription(descText) {
  if (!descText || descText.trim() === '') return null;
    
  const timeStampSection = findTimestampSection(descText);
  if (timeStampSection) {
    descText = timeStampSection;
  }

  const timestampRegex = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[-–—:|]|\s)?\s*(.+?)(?=\n\s*\d{1,2}:\d{2}(?::\d{2})?|\n*$)/gm;

  const normalizeTime = (rawTime) => {
    const parts = rawTime.split(':').map(part => part.padStart(2, '0'));
    if (parts.length === 2) parts.unshift('00'); 
    return parts.join(':');
  };

  let matches;
  const timestamps = [];
  const seen = new Set();

  while ((matches = timestampRegex.exec(descText)) !== null) {
    const rawTime = matches[1].trim();
    const rawDesc = matches[2].trim();

    const normalizedTime = normalizeTime(rawTime);
    const key = `${normalizedTime}-${rawDesc}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      timestamps.push({ time: normalizedTime, description: rawDesc });
    }
  }

  console.log("Extracted timestamps:", timestamps);
  return timestamps.length > 0 ? timestamps : null;
}

function findTimestampSection(text) {
  const timeStampHeaders = [
    "Time Stamp", "Timestamps", "TIMESTAMPS", "TIMESTAMP", 
    "Time Stamps", "TIME STAMP", "TIME STAMPS"
  ];
  
  for (const header of timeStampHeaders) {
    const index = text.indexOf(header);
    if (index >= 0) {
      let endIndex = text.length;
      
      const endMarkers = ["-----", "=====", "END", "Subscribe", "Follow me", "#"];
      for (const marker of endMarkers) {
        const markerIndex = text.indexOf(marker, index + header.length);
        if (markerIndex > index && markerIndex < endIndex) {
          endIndex = markerIndex;
        }
      }
      
      return text.substring(index, endIndex);
    }
  }
  
  return null;
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

function createTimestampLink(timestamp) {
  let seconds = 0;
  const parts = timestamp.split(':').map(Number);
  
  if (parts.length === 3) { 
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) { 
    seconds = parts[0] * 60 + parts[1];
  } else {
    seconds = parts[0];
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

async function handleSummarize() {
  const content = document.querySelector('.summarizer-content');
  const summarizeBtn = document.querySelector('.summarizer-btn');
  
  summarizeBtn.disabled = true;
  content.innerHTML = '<p class="summarizer-loading">Generating summary...</p>';
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    const videoTitle = getVideoTitle();
    
    if (!videoId) {
      throw new Error('Could not find video ID');
    }
    
    const transcriptResponse = await fetch(`http://localhost:3000/transcript?videoId=${videoId}`);
    if (!transcriptResponse.ok) {
      throw new Error('Failed to fetch transcript from server');
    }
    
    const transcriptData = await transcriptResponse.json();
    
    const descriptionTimestamps = await Promise.resolve(extractTimestampsFromDescription());

    console.log("Description timestamps:", descriptionTimestamps); // Debug log

    console.log("Transcript data:", transcriptData); // Debug log
    
    const summaryResponse = await fetch('http://localhost:3000/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        transcript: transcriptData.transcript,
        videoTitle: videoTitle,
        existingTimestamps: descriptionTimestamps,
        duration: transcriptData.duration,
        lang: transcriptData.lang
      })
    });
    
    if (!summaryResponse.ok) {
      throw new Error('Failed to generate summary');
    }
    
    const summaryData = await summaryResponse.json();
    console.log("Received summary data:", summaryData); 
    
    let summaryHTML = `<div class="summary-container">`;
    
    summaryHTML += `
      <div class="summary-section">
        <h3 class="summary-section-title">Summary</h3>
        <h4 class="video-title">${summaryData.title || videoTitle}</h4>
        <ul class="summary-points">
    `;
    
    summaryData.summaryPoints.forEach(point => {
      summaryHTML += `<li>${point}</li>`;
    });
    
    summaryHTML += `</ul></div>`;
    
    summaryHTML += `
      <div class="summary-section">
        <h3 class="summary-section-title">Highlights</h3>
        <ul class="highlight-points">
    `;
    
    if (summaryData.highlights && summaryData.highlights.length > 0) {
      summaryData.highlights.forEach(highlight => {
        if (highlight.timestamp && highlight.description) {
          const timestampLink = createTimestampLink(highlight.timestamp);
          summaryHTML += `
            <li>
              <a href="${timestampLink}" class="timestamp-link">${highlight.timestamp}</a> - ${highlight.description}
            </li>
          `;
        }
      });
    } else {
      summaryHTML += `<li>No highlights available</li>`;
    }
    
    summaryHTML += `</ul></div></div>`;
    
    content.innerHTML = summaryHTML;
    
    const timestampLinks = content.querySelectorAll('a[href*="&t="]');
    timestampLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = new URL(link.href);
        const timeParam = url.searchParams.get('t');
        if (timeParam) {
          const videoPlayer = document.querySelector('video');
          if (videoPlayer) {
            const seconds = parseInt(timeParam.replace('s', ''));
            videoPlayer.currentTime = seconds;
          }
        }
      });
    });
    
  } catch (error) {
    content.innerHTML = `<p class="summarizer-error">Error: ${error.message}</p>`;
  } finally {
    summarizeBtn.disabled = false;
  }
}