# GitHub PR Contributor Sorter

A browser extension that helps you prioritize GitHub pull requests by sorting them based on contributor status, making it easier to spot and review contributions from new contributors who might need extra attention.

## Features

- 🆕 **Identify New Contributors**: Automatically detects first-time contributors to your repository
- 🔄 **Sort by Experience**: Sort PRs to prioritize new or existing contributors
- 👥 **Visual Indicators**: Adds badges to PRs showing contributor status
- 🎯 **Smart Filtering**: Uses GitHub's `author_association` field for accurate contributor classification
- 🌙 **Dark Mode Support**: Works seamlessly with GitHub's dark theme
- 💾 **Persistent Settings**: Remembers your sorting preferences
- 🔑 **GitHub Token Support**: Add your personal access token for unlimited API requests
- ⚡ **GraphQL Batch Fetching**: Efficiently fetches multiple PRs in a single request when authenticated
- 🚀 **Smart Caching**: Persistent caching reduces redundant API calls and improves performance

## Installation

### From Source (Developer Mode)

1. **Download the Extension**
   ```bash
   git clone <repository-url>
   cd sortPR
   ```

2. **Generate Icons** (Required)
   - Open `icons/icon-generator.html` in your browser
   - Download all four icon sizes (16x16, 32x32, 48x48, 128x128)
   - Save them in the `icons/` directory with the correct names

3. **Load in Chrome/Edge**
   - Open Chrome/Edge and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `sortPR` folder

4. **Load in Firefox**
   - Open Firefox and go to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file

## Usage

1. **Navigate to GitHub**: Go to any GitHub repository's pull requests page (e.g., `https://github.com/owner/repo/pulls`)

2. **Configure GitHub Token (Recommended)**: 
   - Click the extension icon to open the popup
   - Add your GitHub personal access token for unlimited requests
   - Without a token: Limited to 60 API requests/hour, processes up to 10 PRs
   - With a token: Unlimited requests, processes up to 50 PRs with GraphQL batch fetching

3. **Sort PRs**: Click one of the sorting options:
   - **🆕 New Contributors First**: Prioritizes PRs from first-time contributors
   - **🔄 Existing Contributors First**: Shows experienced contributors first  
   - **📋 Default Order**: Restores GitHub's original sorting

4. **View Contributor Badges**: Each PR will show a badge indicating whether the author is a new or existing contributor

## Extension Structure

```
sortPR/
├── manifest.json          # Extension manifest
├── content.js            # Main functionality (injected into GitHub pages)
├── popup.html           # Extension popup interface
├── popup.js             # Popup functionality
├── background.js        # Background service worker
├── styles.css          # Styling for the extension UI
├── icons/              # Extension icons
│   ├── icon-generator.html  # Tool to generate icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## API Usage

The extension intelligently uses both GitHub's REST and GraphQL APIs:

### Without Token (Rate Limited)
```javascript
GET https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}
```
- Limited to 60 requests/hour
- Processes up to 10 PRs
- Individual REST API calls

### With Token (Unlimited)
```javascript
POST https://api.github.com/graphql
```
- Unlimited requests
- Processes up to 50 PRs  
- Batch GraphQL queries for efficiency
- Falls back to REST API if needed

**Required Token Scopes:** `public_repo` for accessing public repository data

**Caching:** Smart caching system stores PR data for 30 minutes to minimize API usage

## Privacy & Permissions

- **No Personal Data Collection**: The extension only reads publicly available PR data
- **Local Storage Only**: Settings are stored locally in your browser
- **GitHub API Access**: Uses GitHub's public API to fetch PR contributor information
- **Active Tab Permission**: Required to interact with GitHub pages
- **Storage Permission**: Used to save your sorting preferences

## Browser Support

- ✅ Chrome/Chromium (Manifest V3)
- ✅ Microsoft Edge (Manifest V3)
- ✅ Firefox (with minor compatibility)

## Development

### Testing Locally

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the reload button for the extension
4. Refresh any GitHub PR pages to see changes

### Key Files

- **`content.js`**: Main logic for detecting PRs, fetching data, and sorting
- **`popup.html/js`**: Extension popup interface and settings
- **`background.js`**: Service worker for handling extension lifecycle
- **`styles.css`**: All styling including dark mode support

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Troubleshooting

### Extension Not Working
- Make sure you're on a GitHub repository's pull requests page
- Check that the extension is enabled in your browser
- Look for any console errors in the browser's developer tools

### API Rate Limiting
- Without a token: Limited to 60 requests per hour, processes up to 10 PRs
- With a GitHub token: Unlimited requests, processes up to 50 PRs using GraphQL for efficient batch fetching
- Add your token in the extension popup for the best experience


## License

MIT License - Feel free to use and modify as needed.

## Support

If you encounter any issues or have feature requests, please open an issue on the project repository.