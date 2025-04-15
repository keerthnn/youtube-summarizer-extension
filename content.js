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
    summarizeBtn.textContent = 'Summarize Video';
    summarizeBtn.addEventListener('click', handleSummarize);

    const content = document.createElement('div');
    content.classList.add('summarizer-content');
    content.innerHTML = `<p class="summarizer-placeholder">Click "Summarize Video" to get summary</p>`;

    const footer = document.createElement('div');
    footer.classList.add('summarizer-footer');
    footer.innerHTML = `
      <button class="summarizer-share-btn">Copy Summary</button>
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
  const descriptionElement = document.querySelector('#description-inline-expander');
  if (!descriptionElement) return null;
  
  const descText = descriptionElement.textContent;
  const timestampRegex = /(\d+:\d+(?::\d+)?)\s+-\s+(.+?)(?=\n\d+:\d+|$)/g;
  
  let matches;
  const timestamps = [];
  
  while ((matches = timestampRegex.exec(descText)) !== null) {
    timestamps.push({
      time: matches[1],
      description: matches[2].trim()
    });
  }
  
  return timestamps.length > 0 ? timestamps : null;
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
    const titleEl = document.querySelector('h1.title yt-formatted-string') || document.querySelector('h1.title');
    const videoTitle = titleEl?.textContent.trim() || "YouTube Video";
    
    if (!videoId) {
      throw new Error('Could not find video ID');
    }
    
    const transcriptResponse = await fetch(`http://localhost:3000/transcript?videoId=${videoId}`);
    if (!transcriptResponse.ok) {
      throw new Error('Failed to fetch transcript from server');
    }
    
    const transcriptData = await transcriptResponse.json();
    
    const descriptionTimestamps = extractTimestampsFromDescription();

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