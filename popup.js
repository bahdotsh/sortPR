// GitHub PR Contributor Sorter - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  await checkCurrentPage();
  await loadCurrentSettings();
  setupEventListeners();
  setupSortingControls();
});

async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const statusElement = document.getElementById('page-status');
    const sortingSection = document.getElementById('sorting-section');
    
    if (tab.url && tab.url.includes('github.com') && tab.url.includes('/pulls')) {
      statusElement.className = 'status active';
      statusElement.innerHTML = '<span>✅ Extension is active on this page</span>';
      sortingSection.style.display = 'block';
    } else {
      statusElement.className = 'status inactive';
      statusElement.innerHTML = '<span>⚠️ Navigate to a GitHub repository\'s pull requests page</span>';
      sortingSection.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking current page:', error);
  }
}

async function loadCurrentSettings() {
  try {
    const result = await chrome.storage.local.get(['prSortOrder', 'githubToken']);
    const sortOrder = result.prSortOrder || 'default';
    const githubToken = result.githubToken || '';
    
    updateCurrentSortDisplay(sortOrder);
    updateSortButtonStates(sortOrder);
    updateTokenStatus(githubToken);
    updateAPIMode(githubToken);
    
    // Load token into input field (masked)
    if (githubToken) {
      document.getElementById('github-token').value = githubToken;
    }
  } catch (error) {
    console.error('Error loading current settings:', error);
  }
}

function setupEventListeners() {
  // Open GitHub button
  document.getElementById('open-github').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com' });
    window.close();
  });

  // Refresh page button
  document.getElementById('refresh-page').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        await chrome.tabs.reload(tab.id);
        window.close();
      }
    } catch (error) {
      console.error('Error refreshing page:', error);
    }
  });

  // Help link
  document.getElementById('help-link').addEventListener('click', (e) => {
    e.preventDefault();
    showHelp();
  });

  // Token management
  document.getElementById('save-token').addEventListener('click', saveGitHubToken);
  document.getElementById('clear-token').addEventListener('click', clearGitHubToken);
}

function setupSortingControls() {
  // Sorting buttons
  document.getElementById('sort-new-first').addEventListener('click', () => {
    triggerSort('new-first');
  });

  document.getElementById('sort-existing-first').addEventListener('click', () => {
    triggerSort('existing-first');
  });

  document.getElementById('sort-default').addEventListener('click', () => {
    triggerSort('default');
  });
}

async function triggerSort(sortOrder) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url || !tab.url.includes('github.com') || !tab.url.includes('/pulls')) {
      showSortStatus('Please navigate to a GitHub pull requests page first', 'error');
      return;
    }

    // Update button states
    updateSortButtonStates(sortOrder);
    
    // Show loading status
    showSortStatus('Sorting pull requests...', 'loading');

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'SORT_PRS',
      sortOrder: sortOrder
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error communicating with content script:', chrome.runtime.lastError);
        showSortStatus('Error: Extension not loaded on this page. Try refreshing.', 'error');
        return;
      }

      if (response && response.success) {
        showSortStatus(response.message || 'Sort applied successfully!', 'success');
        // Update current sort in storage and UI
        chrome.storage.local.set({ prSortOrder: sortOrder });
        updateCurrentSortDisplay(sortOrder);
      } else {
        const errorMessage = response && response.message ? response.message : 'Error applying sort. Check console for details.';
        
        if (errorMessage.includes('rate limit')) {
          showSortStatus('⚠️ GitHub API rate limit exceeded. Add a GitHub token above for unlimited requests.', 'error');
        } else {
          showSortStatus(errorMessage, 'error');
        }
      }
    });

  } catch (error) {
    console.error('Error triggering sort:', error);
    showSortStatus('Unexpected error occurred', 'error');
  }
}

function updateSortButtonStates(activeSortOrder) {
  // Reset all buttons to secondary style
  const buttons = ['sort-new-first', 'sort-existing-first', 'sort-default'];
  buttons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    button.className = 'btn secondary';
  });

  // Set active button to primary style
  const activeButton = document.getElementById('sort-' + activeSortOrder);
  if (activeButton) {
    activeButton.className = 'btn';
  }
}

function showSortStatus(message, type) {
  const statusContainer = document.getElementById('sort-status');
  const statusText = document.getElementById('sort-status-text');
  
  statusText.textContent = message;
  statusContainer.style.display = 'block';
  
  // Auto-hide after a few seconds for non-loading states
  if (type !== 'loading') {
    setTimeout(() => {
      statusContainer.style.display = 'none';
    }, 3000);
  }
}

function updateCurrentSortDisplay(sortOrder) {
  const currentSortElement = document.getElementById('current-sort');
  const sortLabels = {
    'new-first': 'New Contributors First',
    'existing-first': 'Existing Contributors First',
    'default': 'Default'
  };
  
  currentSortElement.textContent = sortLabels[sortOrder] || 'Default';
}

async function saveGitHubToken() {
  const tokenInput = document.getElementById('github-token');
  const token = tokenInput.value.trim();
  
  if (token && !token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    showSortStatus('Invalid token format. Must start with ghp_ or github_pat_', 'error');
    return;
  }
  
  try {
    await chrome.storage.local.set({ githubToken: token });
    updateTokenStatus(token);
    updateAPIMode(token);
    showSortStatus(token ? 'Token saved successfully!' : 'Token cleared!', 'success');
  } catch (error) {
    console.error('Error saving token:', error);
    showSortStatus('Error saving token', 'error');
  }
}

async function clearGitHubToken() {
  try {
    await chrome.storage.local.remove('githubToken');
    document.getElementById('github-token').value = '';
    updateTokenStatus('');
    updateAPIMode('');
    showSortStatus('Token cleared successfully!', 'success');
  } catch (error) {
    console.error('Error clearing token:', error);
    showSortStatus('Error clearing token', 'error');
  }
}

function updateTokenStatus(token) {
  const statusElement = document.getElementById('token-status');
  statusElement.textContent = token ? 'Set (Authenticated)' : 'Not Set';
}

function updateAPIMode(token) {
  const modeElement = document.getElementById('api-mode');
  modeElement.textContent = token ? 'GraphQL API (Unlimited)' : 'REST API (Limited)';
}

function showHelp() {
  const helpContent = `
GitHub PR Contributor Sorter Help

🎯 Purpose:
This extension helps you prioritize pull requests by sorting them based on contributor status, making it easier to spot and review contributions from new contributors who might need extra attention.

🔧 How to use:
1. Navigate to any GitHub repository's pull requests page
2. Add a GitHub token (optional but recommended for unlimited requests)
3. Click the sorting buttons to organize PRs by contributor status

👥 Contributor Types:
• New Contributors: FIRST_TIMER, FIRST_TIME_CONTRIBUTOR, or NONE
• Existing Contributors: CONTRIBUTOR, COLLABORATOR, MEMBER, or OWNER

📊 Sorting Options:
• New Contributors First: Prioritizes PRs from new contributors
• Existing Contributors First: Shows experienced contributors first
• Default Order: Restores GitHub's original sorting

🔑 GitHub Token:
• Optional but recommended for unlimited API requests
• Requires 'public_repo' scope
• Stored securely in your browser's local storage

🔐 Privacy:
This extension only reads publicly available PR data from GitHub's API. Your token is stored locally and never transmitted anywhere except to GitHub's official API.

Need more help? Check the GitHub repository for this extension.
  `;

  alert(helpContent);
}