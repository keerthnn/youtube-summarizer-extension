window.addEventListener('load', () => {
  if (window.location.pathname.includes('/watch')) {
    injectSummarizerUI();
  }
});

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (window.location.pathname.includes('/watch')) {
      injectSummarizerUI();
      
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

    document.body.appendChild(summarizer);
    
    const copyButton = controls.querySelector('button:nth-child(1)');
    copyButton.addEventListener('click', () => {
      const summary = document.querySelector('.summary-container')?.textContent;
      if (summary) {
        navigator.clipboard.writeText(summary);
        const originalText = copyButton.querySelector('span').textContent;
        copyButton.querySelector('span').textContent = '✓';
        setTimeout(() => {
          copyButton.querySelector('span').textContent = originalText;
        }, 1500);
      }
    });
  }, 1000); 
}

function showMinimizedButton() {
  let miniButton = document.getElementById('summarizer-mini-btn');
  if (!miniButton) {
    miniButton = document.createElement('button');
    miniButton.id = 'summarizer-mini-btn';
    miniButton.classList.add('summarizer-mini-button');
    miniButton.innerHTML = `
      <span>Summarize</span>
    `;
    
    miniButton.addEventListener('click', () => {
      const summarizer = document.getElementById('video-summarizer');
      if (summarizer) {
        summarizer.classList.remove('summarizer-minimized');
        miniButton.style.display = 'none';
      } else {
        injectSummarizerUI();
        miniButton.style.display = 'none';
      }
    });
    
    document.body.appendChild(miniButton);
  }
  
  miniButton.style.display = 'flex';
}

function isQuestion(title) {
  return title.includes('?') || 
    title.toLowerCase().startsWith('how') || 
    title.toLowerCase().startsWith('what') || 
    title.toLowerCase().startsWith('why') || 
    title.toLowerCase().startsWith('when') || 
    title.toLowerCase().startsWith('where') || 
    title.toLowerCase().startsWith('who') || 
    title.toLowerCase().startsWith('which') || 
    title.toLowerCase().startsWith('can') || 
    title.toLowerCase().startsWith('will');
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
  } else if (parts.length === 2) { // MM:SS
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
    const isQuestionTitle = isQuestion(videoTitle);
    
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
        isQuestion: isQuestionTitle,
        existingTimestamps: descriptionTimestamps
      })
    });
    
    if (!summaryResponse.ok) {
      throw new Error('Failed to generate summary');
    }
    
    const summaryData = await summaryResponse.json();
    console.log("Received summary data:", summaryData); // Debug log
    
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
    
    if (isQuestionTitle && summaryData.answer) {
      summaryHTML += `
        <div class="summary-section">
          <h3 class="summary-section-title">Answer to "${videoTitle}"</h3>
          <p class="title-answer">${summaryData.answer}</p>
      `;
      
      if (summaryData.answerTimestamp) {
        const timestampLink = createTimestampLink(summaryData.answerTimestamp);
        summaryHTML += `<p class="answer-timestamp">Answer found at <a href="${timestampLink}" target="_blank">${summaryData.answerTimestamp}</a></p>`;
      }
      
      summaryHTML += `</div>`;
    }
    
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