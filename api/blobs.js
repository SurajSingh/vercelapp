const { list } = require('@vercel/blob');

class VercelBlobService {
  constructor() {
    this.baseUrl = process.env.BASE_URL;
    this.rootFolder = process.env.ROOT_FOLDER || 'Skeidar-Assets';
    this.teamId = process.env.VERCEL_TEAM_ID;
    
    if (!process.env.VERCEL_ACCESS_TOKEN) {
      throw new Error('VERCEL_ACCESS_TOKEN is required');
    }
  }

  async getAllBlobs() {
    try {
      const prefixOptions = [
        `${this.rootFolder}/`,
        this.rootFolder,
        ''
      ];
      
      let blobs = [];
      let lastError = null;
      
      for (const prefix of prefixOptions) {
        try {
          const result = await list({
            limit: 1000,
            prefix: prefix,
            token: process.env.VERCEL_ACCESS_TOKEN,            
            ...(this.teamId && { teamId: this.teamId })
          });
          
          blobs = result.blobs;
          if (blobs.length > 0) {
            break;
          }
        } catch (error) {
          lastError = error;
          continue;
        }
      }
      
      if (blobs.length === 0 && this.teamId) {
        try {
          const result = await list({
            limit: 1000,
            prefix: `${this.rootFolder}/`,
            token: process.env.VERCEL_ACCESS_TOKEN
          });
          
          blobs = result.blobs;          
        } catch (error) {          
          lastError = error;
        }
      }
      
      if (blobs.length === 0 && lastError) {
        throw lastError;
      }
      
      return this.organizeBlobsByFolder(blobs);
    } catch (error) {
      console.error('Error fetching blobs from Vercel:', error);
      
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        throw new Error('Authentication failed. Check your VERCEL_ACCESS_TOKEN.');
      }
      if (error.message.includes('403') || error.message.includes('forbidden')) {
        throw new Error('Access forbidden. Check your VERCEL_ACCESS_TOKEN permissions.');
      }
      if (error.message.includes('404')) {
        throw new Error('Blob store not found. Check your configuration.');
      }
      
      throw error;
    }
  }

  organizeBlobsByFolder(blobs) {
    const folders = {};
    
    blobs.forEach(blob => {
      if (blob.pathname) {
        let pathParts;
        
        if (blob.pathname.startsWith(`${this.rootFolder}/`)) {
          const relativePath = blob.pathname.substring(`${this.rootFolder}/`.length);
          pathParts = relativePath.split('/');
        } else {
          pathParts = blob.pathname.split('/');
        }
        
        if (pathParts.length >= 2) {
          const folderName = pathParts[0];
          
          if (!folders[folderName]) {
            folders[folderName] = [];
          }
          
          folders[folderName].push({
            fileName: pathParts.slice(1).join('/'),
            fileUrl: blob.url,
            fileSize: this.formatFileSize(blob.size),
            contentType: blob.contentType,
            uploadedAt: blob.uploadedAt,
            fullPath: blob.pathname
          });
        } else {
          const rootKey = '_root';
          if (!folders[rootKey]) {
            folders[rootKey] = [];
          }
          
          folders[rootKey].push({
            fileName: blob.pathname,
            fileUrl: blob.url,
            fileSize: this.formatFileSize(blob.size),
            contentType: blob.contentType,
            uploadedAt: blob.uploadedAt,
            fullPath: blob.pathname
          });
        }
      }
    });

    return Object.keys(folders).map(folderName => ({
      folderName,
      files: folders[folderName]
    }));
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

let vercelBlobService;

const initializeServices = () => {
  if (!vercelBlobService) {
    vercelBlobService = new VercelBlobService();
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
    const blobs = await vercelBlobService.getAllBlobs();
    
    res.status(200).json({
      success: true,
      data: blobs,
      totalFolders: blobs.length,
      totalFiles: blobs.reduce((total, folder) => total + folder.files.length, 0)
    });
  } catch (error) {
    console.error('Error fetching blobs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};
