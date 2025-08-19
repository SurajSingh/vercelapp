const { list } = require('@vercel/blob');

class FolderBlobService {
  constructor() {
    this.rootFolder = process.env.ROOT_FOLDER || 'Skeidar-Assets';
    this.teamId = process.env.VERCEL_TEAM_ID;
    
    if (!process.env.VERCEL_ACCESS_TOKEN) {
      throw new Error('VERCEL_ACCESS_TOKEN is required');
    }
  }

  async getBlobsByFolder(folderName) {
    try {
      const prefixOptions = [
        `${folderName}/`,
        folderName
      ];
      
      let blobs = [];
      let lastError = null;
      
      for (const prefix of prefixOptions) {
        try {
          const listOptions = {
            limit: 1000,
            prefix: prefix,
            token: process.env.VERCEL_ACCESS_TOKEN
          };
          
          if (this.teamId) {
            listOptions.teamId = this.teamId;
          }
          
          const result = await list(listOptions);
          blobs = result.blobs;
          
          if (blobs.length > 0) {
            break;
          }
        } catch (error) {
          lastError = error;
          continue;
        }
      }
      
      if (blobs.length === 0) {
        try {
          const allBlobsResult = await list({
            limit: 1000,
            token: process.env.VERCEL_ACCESS_TOKEN,
            ...(this.teamId && { teamId: this.teamId })
          });
          
          blobs = allBlobsResult.blobs.filter(blob => {
            const pathParts = blob.pathname.split('/');
            return pathParts[0] === folderName || blob.pathname.startsWith(`${folderName}/`);
          });
        } catch (error) {
          lastError = error;
        }
      }
      
      if (blobs.length === 0) {
        try {
          const allBlobsResult = await list({
            limit: 1000,
            token: process.env.VERCEL_ACCESS_TOKEN,
            ...(this.teamId && { teamId: this.teamId })
          });
          
          const availableFolders = [...new Set(allBlobsResult.blobs.map(blob => blob.pathname.split('/')[0]))];
          
          throw new Error(`Folder "${folderName}" not found. Available folders: ${availableFolders.join(', ')}`);
        } catch (debugError) {
          if (lastError) throw lastError;
          throw debugError;
        }
      }
      
      return this.processFolderBlobs(blobs, folderName);
    } catch (error) {
      throw error;
    }
  }

  processFolderBlobs(blobs, folderName) {
    const files = blobs
      .filter(blob => blob.size > 0) // Filter out 0-byte files
      .map(blob => ({
        fileName: blob.pathname.split('/').pop(),
        fileUrl: blob.url,
        fileSize: this.formatFileSize(blob.size),
        contentType: blob.contentType,
        uploadedAt: blob.uploadedAt,
        fullPath: blob.pathname
      }));

    return {
      folderName,
      files
    };
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

let folderBlobService;

const initializeServices = () => {
  if (!folderBlobService) {
    folderBlobService = new FolderBlobService();
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
    
    // Extract folderName from the URL path (without query parameters)
    const urlPath = req.url.split('?')[0]; // Remove query parameters
    const urlParts = urlPath.split('/');
    const folderNameIndex = urlParts.indexOf('blobs') + 1;
    const folderName = urlParts[folderNameIndex];
    
    if (!folderName) {
      return res.status(400).json({
        success: false,
        error: 'Folder name required',
        message: 'Please provide a folder name in the URL'
      });
    }
    
    const folderData = await folderBlobService.getBlobsByFolder(folderName);
    
    if (!folderData.files || folderData.files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
        message: `No files found in folder: ${folderName}`
      });
    }
    
    res.status(200).json({
      success: true,
      data: folderData,
      totalFiles: folderData.files.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};
