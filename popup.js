document.addEventListener('DOMContentLoaded', function() {
  // Check if the backend server is reachable
  checkServerConnection();
  
  // Add event listener to the summarize button
  const summarizeButton = document.getElementById('summarize-current');
  summarizeButton.addEventListener('click', handleSummarizeClick);
});

async function checkServerConnection() {
  try {
    // Try to ping the backend server
    const response = await fetch('http://localhost:3000/ping', { 
      method: 'GET',
      // Add timeout to avoid long waiting if server is down
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      // Server is up and running
      updateStatus(true);
    } else {
      // Server responded but with an error
      updateStatus(false);
    }
  } catch (error) {
    // Could not reach the server
    updateStatus(false);
  }
}

function updateStatus(isConnected) {
  const statusBadge = document.querySelector('.status-badge');
  const statusInfo = document.querySelector('.info-container p:nth-child(2)');
  const summarizeButton = document.getElementById('summarize-current');
  
  if (isConnected) {
    statusBadge.textContent = 'Ready to Use';
    statusBadge.style.backgroundColor = '#10b981'; // Green
    summarizeButton.disabled = false;
  } else {
    statusBadge.textContent = 'Server Offline';
    statusBadge.style.backgroundColor = '#ef4444'; // Red
    statusInfo.textContent = 'The summarization server appears to be offline. Please make sure the server is running.';
    summarizeButton.disabled = true;
  }
}

// Handle click on summarize button
async function handleSummarizeClick() {
  const summarizeButton = document.getElementById('summarize-current');
  summarizeButton.disabled = true;
  summarizeButton.textContent = 'Processing...';
  
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on a YouTube video page
    if (!tab.url.includes('youtube.com/watch')) {
      alert('Please navigate to a YouTube video first.');
      summarizeButton.disabled = false;
      summarizeButton.textContent = 'Summarize Current Video';
      return;
    }
    
    // Execute script in the active tab to trigger the summarization
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: triggerSummarize
    });
    
    // Update button state
    summarizeButton.textContent = 'Summary Generated!';
    setTimeout(() => {
      summarizeButton.textContent = 'Summarize Current Video';
      summarizeButton.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
    summarizeButton.textContent = 'Summarize Current Video';
    summarizeButton.disabled = false;
  }
}

// This function will be injected into the page
function triggerSummarize() {
  // Find the summarize button on the page and click it
  const summarizeBtn = document.querySelector('.summarizer-btn');
  if (summarizeBtn) {
    summarizeBtn.click();
  } else {
    // If button doesn't exist yet, inject UI first
    if (typeof injectSummarizerUI === 'function') {
      injectSummarizerUI();
      // Wait a bit for the UI to render
      setTimeout(() => {
        const newBtn = document.querySelector('.summarizer-btn');
        if (newBtn) newBtn.click();
      }, 500);
    }
  }
}