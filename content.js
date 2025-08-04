// GitHub PR Contributor Sorter - Content Script (Clean Version)
class PRSorter {
  constructor() {
    this.prData = new Map();
    this.sortOrder = 'default';
    this.isLoading = false;
    this.debug = true;
    this.githubToken = null;
    this.cache = new Map(); // In-memory cache
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.init();
  }

  log(message, ...args) {
    if (this.debug) {
      console.log('[PR Sorter]', message, ...args);
    }
  }

  async init() {
    this.log('Initializing PR Sorter on:', window.location.href);
    await this.loadSettings();
    this.observePageChanges();
    this.setupMessageListener();
  }

  setupMessageListener() {
    this.log('Setting up message listener for popup communication');
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.log('Received message:', message);
      
      if (message.type === 'SORT_PRS') {
        this.handleSortRequest(message.sortOrder, sendResponse);
        return true; // Will respond asynchronously
      }
    });
  }

  async handleSortRequest(sortOrder, sendResponse) {
    try {
      this.log('Processing sort request:', sortOrder);
      
      // Check if we're on a valid page
      if (!window.location.href.includes('github.com') || !window.location.href.includes('/pulls')) {
        sendResponse({ 
          success: false, 
          message: 'Not on a GitHub pull requests page' 
        });
        return;
      }

      this.sortOrder = sortOrder;
      this.saveSortPreference();

      if (sortOrder === 'default') {
        this.restoreDefaultOrder();
        sendResponse({ 
          success: true, 
          message: 'Restored to default order' 
        });
        return;
      }

      // Fetch PR data and apply sorting
      await this.fetchPRData();
      this.applySorting();
      
      const sortLabel = sortOrder === 'new-first' ? 'new contributors' : 'existing contributors';
      sendResponse({ 
        success: true, 
        message: `Sorted by ${sortLabel} successfully!` 
      });

    } catch (error) {
      this.log('Error in handleSortRequest:', error);
      sendResponse({ 
        success: false, 
        message: 'Error sorting PRs: ' + error.message 
      });
    }
  }



  async fetchPRData() {
    // Clean expired cache first
    this.clearExpiredCache();
    
    const prElements = document.querySelectorAll('a[href*="/pull/"]');
    
    // With token, we can fetch more PRs; without token, limit to 10
    const maxPRs = this.githubToken ? 50 : 10;
    const limitedElements = Array.from(prElements).slice(0, maxPRs);
    
    this.log(`Processing ${limitedElements.length} PRs (${this.githubToken ? 'authenticated' : 'rate limited'})`);
    
    // Extract PR numbers and check what we need to fetch
    const allPRNumbers = limitedElements
      .map(el => this.extractPRNumber(el))
      .filter(num => num);
    
    // Load cached data first
    for (const prNumber of allPRNumbers) {
      if (!this.prData.has(prNumber)) {
        const cached = this.getFromCache(prNumber);
        if (cached) {
          this.prData.set(prNumber, cached);
        }
      }
    }
    
    // Determine what still needs to be fetched
    const prNumbersToFetch = allPRNumbers.filter(num => !this.prData.has(num));
    
    if (prNumbersToFetch.length === 0) {
      this.log('All PR data available from cache');
      return;
    }
    
    this.log(`Fetching ${prNumbersToFetch.length} new PRs from API`);
    
    // Use GraphQL for batch fetching if we have a token, otherwise use REST API
    if (this.githubToken && prNumbersToFetch.length > 3) {
      try {
        await this.fetchPRDataGraphQL(prNumbersToFetch);
      } catch (error) {
        this.log('GraphQL failed, falling back to REST API:', error.message);
        await this.fetchPRDataREST(prNumbersToFetch);
      }
    } else {
      await this.fetchPRDataREST(prNumbersToFetch);
    }
  }

  extractPRNumber(prElement) {
    if (prElement && prElement.href) {
      const match = prElement.href.match(/\/pull\/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    return null;
  }

  async fetchPRDataREST(prNumbers) {
    for (const prNumber of prNumbers) {
      try {
        // Check cache first
        const cached = this.getFromCache(prNumber);
        if (cached) {
          this.prData.set(prNumber, cached);
          continue;
        }
        
        const prData = await this.fetchPRDetails(prNumber);
        this.prData.set(prNumber, prData);
        this.setCache(prNumber, prData);
        
        // Delay between requests if no token
        if (!this.githubToken) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        this.log('Failed to fetch data for PR #' + prNumber + ':', error.message);
        
        // If we get rate limited, stop trying
        if (error.message.includes('403')) {
          this.log('⚠️ Hit GitHub rate limit. Stopping API requests.');
          throw new Error('GitHub API rate limit exceeded. Please add a GitHub token for unlimited requests.');
        }
      }
    }
  }
  
  async fetchPRDataGraphQL(prNumbers) {
    const pathParts = window.location.pathname.split('/');
    const owner = pathParts[1];
    const repo = pathParts[2];
    
    // Build GraphQL query for multiple PRs
    const queries = prNumbers.map((prNumber, index) => {
      return `
        pr${index}: pullRequest(number: ${prNumber}) {
          number
          authorAssociation
          createdAt
          author {
            login
            ... on User {
              id
            }
          }
        }`;
    }).join('');
    
    const query = `
      query GetPullRequests {
        repository(owner: "${owner}", name: "${repo}") {
          ${queries}
        }
      }`;
    
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PR-Contributor-Sorter/2.0'
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      throw new Error(`GraphQL API error: ${response.status} - ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.errors) {
      throw new Error('GraphQL errors: ' + JSON.stringify(result.errors));
    }
    
    // Process the results
    const repository = result.data.repository;
    prNumbers.forEach((prNumber, index) => {
      const prData = repository[`pr${index}`];
      if (prData) {
        const processedData = {
          number: prData.number,
          author_association: prData.authorAssociation,
          created_at: prData.createdAt,
          user: prData.author
        };
        this.prData.set(prNumber, processedData);
        this.setCache(prNumber, processedData);
      }
    });
    
    this.log(`Fetched ${prNumbers.length} PRs via GraphQL`);
  }
  
  async fetchPRDetails(prNumber) {
    const pathParts = window.location.pathname.split('/');
    const owner = pathParts[1];
    const repo = pathParts[2];
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PR-Contributor-Sorter/2.0'
    };
    
    if (this.githubToken) {
      headers['Authorization'] = `Bearer ${this.githubToken}`;
    }
    
    const response = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/pulls/' + prNumber, {
      headers
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const remaining = response.headers.get('x-ratelimit-remaining');
        this.log(`Rate limit info - Remaining: ${remaining}, Reset: ${resetTime}`);
        
        throw new Error('GitHub API rate limit exceeded (403). Add a GitHub token for unlimited requests.');
      }
      throw new Error('GitHub API error: ' + response.status + ' - ' + response.statusText);
    }
    
    const data = await response.json();
    return {
      number: prNumber,
      author_association: data.author_association,
      created_at: data.created_at,
      user: data.user
    };
  }

  applySorting() {
    const prContainer = document.querySelector('[data-testid="results-list"]') || 
                       document.querySelector('.js-active-navigation-container') ||
                       document.querySelector('.js-navigation-container');
    
    if (!prContainer) {
      this.log('❌ Could not find PR container for sorting');
      return;
    }

    const prElements = Array.from(prContainer.querySelectorAll('.js-navigation-item, .js-issue-row'));
    
    if (prElements.length === 0) {
      this.log('❌ No PR elements found for sorting');
      return;
    }

    this.log('Sorting ' + prElements.length + ' PR elements');
    
    // Store original order if not already stored
    if (!prContainer.hasAttribute('data-original-order')) {
      prContainer.setAttribute('data-original-order', 'true');
      prElements.forEach((el, index) => {
        el.setAttribute('data-original-index', index.toString());
      });
    }

    // Sort elements
    const sortedElements = prElements.sort((a, b) => {
      const prNumberA = this.extractPRNumber(a.querySelector('a[href*="/pull/"]'));
      const prNumberB = this.extractPRNumber(b.querySelector('a[href*="/pull/"]'));
      
      const dataA = this.prData.get(prNumberA);
      const dataB = this.prData.get(prNumberB);
      
      if (!dataA || !dataB) return 0;
      
      const priorityA = this.getContributorPriority(dataA.author_association);
      const priorityB = this.getContributorPriority(dataB.author_association);
      
      if (this.sortOrder === 'new-first') {
        return priorityA - priorityB;
      } else {
        return priorityB - priorityA;
      }
    });

    // Re-append elements in sorted order
    sortedElements.forEach(element => {
      prContainer.appendChild(element);
    });

    this.addContributorBadges();
  }

  getContributorPriority(authorAssociation) {
    const newContributorStatuses = ['FIRST_TIMER', 'FIRST_TIME_CONTRIBUTOR', 'NONE'];
    return newContributorStatuses.includes(authorAssociation) ? 1 : 2;
  }

  addContributorBadges() {
    const prElements = document.querySelectorAll('.js-navigation-item, .js-issue-row');
    
    prElements.forEach(prElement => {
      const prLink = prElement.querySelector('a[href*="/pull/"]');
      const prNumber = this.extractPRNumber(prLink);
      const prData = this.prData.get(prNumber);
      
      if (prData && !prElement.querySelector('.contributor-badge')) {
        const badge = this.createContributorBadge(prData.author_association);
        
        if (prLink) {
          prLink.parentElement.insertBefore(badge, prLink.nextSibling);
        }
      }
    });
  }

  createContributorBadge(authorAssociation) {
    const badge = document.createElement('span');
    badge.className = 'contributor-badge';
    
    const isNewContributor = ['FIRST_TIMER', 'FIRST_TIME_CONTRIBUTOR', 'NONE'].includes(authorAssociation);
    
    if (isNewContributor) {
      badge.className += ' contributor-badge-new';
      badge.textContent = '🆕 New';
      badge.title = 'New contributor (' + authorAssociation + ')';
    } else {
      badge.className += ' contributor-badge-existing';
      badge.textContent = '🔄 Existing';
      badge.title = 'Existing contributor (' + authorAssociation + ')';
    }
    
    return badge;
  }

  restoreDefaultOrder() {
    const prContainer = document.querySelector('[data-testid="results-list"]') || 
                       document.querySelector('.js-active-navigation-container') ||
                       document.querySelector('.js-navigation-container');
                       
    if (!prContainer) return;

    const prElements = Array.from(prContainer.querySelectorAll('.js-navigation-item, .js-issue-row'));
    
    // Sort by original index
    prElements.sort((a, b) => {
      const indexA = parseInt(a.getAttribute('data-original-index') || '0');
      const indexB = parseInt(b.getAttribute('data-original-index') || '0');
      return indexA - indexB;
    });

    // Re-append in original order
    prElements.forEach(element => {
      prContainer.appendChild(element);
    });

    this.log('Restored to default order');
  }



  saveSortPreference() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ prSortOrder: this.sortOrder });
    }
  }

  async loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['prSortOrder', 'githubToken', 'prCache'], (result) => {
          if (result.prSortOrder) {
            this.sortOrder = result.prSortOrder;
            this.log('Loaded sort preference:', this.sortOrder);
          }
          if (result.githubToken) {
            this.githubToken = result.githubToken;
            this.log('Loaded GitHub token (authenticated)');
          }
          if (result.prCache) {
            // Load cache from storage and convert back to Map
            const cacheData = JSON.parse(result.prCache);
            this.cache = new Map(cacheData.entries);
            this.log(`Loaded ${this.cache.size} cached PR entries`);
          }
          resolve();
        });
      });
    }
  }

  getFromCache(prNumber) {
    const cached = this.cache.get(prNumber);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      this.log(`Cache hit for PR #${prNumber}`);
      return cached.data;
    }
    if (cached) {
      // Remove expired entry
      this.cache.delete(prNumber);
      this.saveCacheToStorage();
    }
    return null;
  }
  
  setCache(prNumber, data) {
    this.cache.set(prNumber, {
      data,
      timestamp: Date.now()
    });
    this.saveCacheToStorage();
  }
  
  saveCacheToStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // Convert Map to array for storage
      const cacheData = {
        entries: Array.from(this.cache.entries())
      };
      
      // Limit cache size to prevent storage bloat
      if (cacheData.entries.length > 200) {
        // Keep only the 150 most recent entries
        cacheData.entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        cacheData.entries = cacheData.entries.slice(0, 150);
        this.cache = new Map(cacheData.entries);
      }
      
      chrome.storage.local.set({ prCache: JSON.stringify(cacheData) });
    }
  }
  
  clearExpiredCache() {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [prNumber, cached] of this.cache) {
      if (now - cached.timestamp >= this.cacheExpiry) {
        this.cache.delete(prNumber);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      this.log(`Cleared ${deletedCount} expired cache entries`);
      this.saveCacheToStorage();
    }
  }
  
  observePageChanges() {
    let currentUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.log('URL changed to:', currentUrl);
        // Page changed - just log it, popup will handle UI
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize the PR sorter when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[PR Sorter] DOM loaded, initializing...');
    new PRSorter();
  });
} else {
  console.log('[PR Sorter] Document ready, initializing...');
  new PRSorter();
}