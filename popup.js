document.addEventListener('DOMContentLoaded', function() {
  // Check if the backend server is reachable
  checkServerConnection();
  
  // Add event listener to the summarize button
  const summarizeButton = document.getElementById('summarize-current');
  summarizeButton.addEventListener('click', handleSummarizeClick);
});

async function checkServerConnection() {
  try {
    const response = await fetch('http://localhost:3000/ping', { 
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      updateStatus(true);
    } else {
      updateStatus(false);
    }
  } catch (error) {
    updateStatus(false);
  }
}

function updateStatus(isConnected) {
  const statusBadge = document.querySelector('.status-badge');
  const statusInfo = document.querySelector('.info-container p:nth-child(2)');
  const summarizeButton = document.getElementById('summarize-current');
  
  if (isConnected) {
    statusBadge.textContent = 'Ready to Use';
    statusBadge.style.backgroundColor = '#10b981'; 
    summarizeButton.disabled = false;
  } else {
    statusBadge.textContent = 'Server Offline';
    statusBadge.style.backgroundColor = '#ef4444'; 
    statusInfo.textContent = 'The summarization server appears to be offline. Please make sure the server is running.';
    summarizeButton.disabled = true;
  }
}

async function handleSummarizeClick() {
  const summarizeButton = document.getElementById('summarize-current');
  summarizeButton.disabled = true;
  summarizeButton.textContent = 'Processing...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('youtube.com/watch')) {
      alert('Please navigate to a YouTube video first.');
      summarizeButton.disabled = false;
      summarizeButton.textContent = 'Summarize Current Video';
      return;
    }
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: triggerSummarize
    });
    
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

function triggerSummarize() {
  const summarizeBtn = document.querySelector('.summarizer-btn');
  if (summarizeBtn) {
    summarizeBtn.click();
  } else {
    if (typeof injectSummarizerUI === 'function') {
      injectSummarizerUI();
      setTimeout(() => {
        const newBtn = document.querySelector('.summarizer-btn');
        if (newBtn) newBtn.click();
      }, 500);
    }
  }
}