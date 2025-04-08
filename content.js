// Wait for the page to fully load
window.addEventListener('load', () => {
  // Make sure we're on a YouTube video page
  if (window.location.pathname.includes('/watch')) {
    injectSummarizerUI();
  }
});

// Also try to inject when the URL changes (for single-page app navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (window.location.pathname.includes('/watch')) {
      injectSummarizerUI();
      
      // Reset the summarizer content when navigating to a new video
      const content = document.querySelector('.summarizer-content');
      if (content) {
        content.innerHTML = `<p class="summarizer-placeholder">Click "Summarize Video" to get summary</p>`;
      }
    }
  }
}).observe(document, { subtree: true, childList: true });

function injectSummarizerUI() {
  // Allow a moment for YouTube's UI to stabilize
  setTimeout(() => {
    let summarizer = document.getElementById('video-summarizer');
    
    // If the summarizer already exists, don't recreate it
    if (summarizer) {
      // Just make sure it's visible
      summarizer.classList.remove('summarizer-minimized');
      return;
    }
    
    // Create the summarizer container
    summarizer = document.createElement('div');
    summarizer.id = 'video-summarizer';
    summarizer.classList.add('summarizer-container');

    // Create the header
    const header = document.createElement('div');
    header.classList.add('summarizer-header');

    // Create the name element
    const name = document.createElement('div');
    name.classList.add('summarizer-name');
    name.textContent = 'Video Summary';

    // Create controls container
    const controls = document.createElement('div');
    controls.classList.add('summarizer-controls');
    
    // Add action buttons
    const actionButtons = `
      <button class="summarizer-control-btn" title="Copy"><span>📋</span></button>
      <button class="summarizer-control-btn" title="Close"><span>❌</span></button>
    `;
    controls.innerHTML = actionButtons;

    // Add close button functionality
    const closeButton = controls.querySelector('button:last-child');
    closeButton.addEventListener('click', () => {
      summarizer.classList.add('summarizer-minimized');
      showMinimizedButton();
    });

    // Add all header elements
    header.appendChild(name);
    header.appendChild(controls);

    // Create the summarize button
    const summarizeBtn = document.createElement('button');
    summarizeBtn.classList.add('summarizer-btn');
    summarizeBtn.textContent = 'Summarize Video';
    summarizeBtn.addEventListener('click', handleSummarize);

    // Create the content area
    const content = document.createElement('div');
    content.classList.add('summarizer-content');
    content.innerHTML = `<p class="summarizer-placeholder">Click "Summarize Video" to get summary</p>`;

    // Create the footer
    const footer = document.createElement('div');
    footer.classList.add('summarizer-footer');
    footer.innerHTML = `
      <button class="summarizer-share-btn">Copy Summary</button>
    `;
    
    // Add share functionality
    const shareBtn = footer.querySelector('.summarizer-share-btn');
    shareBtn.addEventListener('click', () => {
      const summary = document.querySelector('.summary-text')?.textContent;
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

    // Add all elements to the container
    summarizer.appendChild(header);
    summarizer.appendChild(summarizeBtn);
    summarizer.appendChild(content);
    summarizer.appendChild(footer);

    // Add the summarizer to the page
    document.body.appendChild(summarizer);
    
    // Add Copy button functionality
    const copyButton = controls.querySelector('button:nth-child(1)');
    copyButton.addEventListener('click', () => {
      const summary = document.querySelector('.summary-text')?.textContent;
      if (summary) {
        navigator.clipboard.writeText(summary);
        // Show feedback
        const originalText = copyButton.querySelector('span').textContent;
        copyButton.querySelector('span').textContent = '✓';
        setTimeout(() => {
          copyButton.querySelector('span').textContent = originalText;
        }, 1500);
      }
    });
  }, 1000); // Delay to ensure YouTube's UI is loaded
}

function showMinimizedButton() {
  // Create minimized button if it doesn't exist
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

async function handleSummarize() {
  const content = document.querySelector('.summarizer-content');
  const summarizeBtn = document.querySelector('.summarizer-btn');
  
  // Update UI to show loading state
  summarizeBtn.disabled = true;
  content.innerHTML = '<p class="summarizer-loading">Generating summary...</p>';
  
  try {
    // Get video ID
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    
    if (!videoId) {
      throw new Error('Could not find video ID');
    }
    
    // First, try to get the transcript from our backend
    const transcriptResponse = await fetch(`http://localhost:3000/transcript?videoId=${videoId}`);
    if (!transcriptResponse.ok) {
      throw new Error('Failed to fetch transcript from server');
    }
    
    const transcriptData = await transcriptResponse.json();
    
    // Now, use our backend to generate the summary
    const summaryResponse = await fetch('http://localhost:3000/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transcript: transcriptData.transcript })
    });
    
    if (!summaryResponse.ok) {
      throw new Error('Failed to generate summary');
    }
    
    const summaryData = await summaryResponse.json();
    
    // Display the summary
    content.innerHTML = `<p class="summary-text">${summaryData.summary}</p>`;
  } catch (error) {
    content.innerHTML = `<p class="summarizer-error">Error: ${error.message}</p>`;
  } finally {
    summarizeBtn.disabled = false;
  }
}