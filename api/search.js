const { list } = require('@vercel/blob');

class SearchService {
  constructor() {
    this.rootFolder = process.env.ROOT_FOLDER || 'Skeidar-Assets';
    this.teamId = process.env.VERCEL_TEAM_ID;
    
    if (!process.env.VERCEL_ACCESS_TOKEN) {
      throw new Error('VERCEL_ACCESS_TOKEN is required');
    }
  }

  async searchBlobs(query) {
    try {
      const result = await list({
        limit: 1000,
        token: process.env.VERCEL_ACCESS_TOKEN,
        ...(this.teamId && { teamId: this.teamId })
      });
      
      const blobs = result.blobs;
      const results = [];
      
      blobs.forEach(blob => {
        if (blob.pathname && blob.size > 0) { // Filter out 0-byte files
          let pathParts;
          
          if (blob.pathname.startsWith(`${this.rootFolder}/`)) {
            const relativePath = blob.pathname.substring(`${this.rootFolder}/`.length);
            pathParts = relativePath.split('/');
          } else {
            pathParts = blob.pathname.split('/');
          }
          
          if (pathParts.length >= 2) {
            const folderName = pathParts[0];
            const fileName = pathParts.slice(1).join('/');
            
            if (folderName.toLowerCase().includes(query.toLowerCase()) ||
                fileName.toLowerCase().includes(query.toLowerCase())) {
              
              const existingFolder = results.find(r => r.folderName === folderName);
              if (existingFolder) {
                existingFolder.files.push({
                  fileName,
                  fileUrl: blob.url,
                  fileSize: this.formatFileSize(blob.size),
                  contentType: blob.contentType,
                  uploadedAt: blob.uploadedAt,
                  fullPath: blob.pathname
                });
              } else {
                results.push({
                  folderName,
                  files: [{
                    fileName,
                    fileUrl: blob.url,
                    fileSize: this.formatFileSize(blob.size),
                    contentType: blob.contentType,
                    uploadedAt: blob.uploadedAt,
                    fullPath: blob.pathname
                  }]
                });
              }
            }
          }
        }
      });
      
      return results;
    } catch (error) {
      throw error;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

let searchService;

const initializeServices = () => {
  if (!searchService) {
    searchService = new SearchService();
  }
};

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    initializeServices();
    const { q: query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter required',
        message: 'Please provide a search query using the "q" parameter'
      });
    }

    const searchResults = await searchService.searchBlobs(query);
    
    res.status(200).json({
      success: true,
      query,
      data: searchResults,
      totalResults: searchResults.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};
