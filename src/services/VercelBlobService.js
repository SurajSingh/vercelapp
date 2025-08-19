const { list } = require('@vercel/blob');

class VercelBlobService {
  constructor() {
    this.baseUrl = process.env.BASE_URL;
    this.rootFolder = process.env.ROOT_FOLDER || 'Skeidar-Assets'; // Default fallback
    this.teamId = process.env.VERCEL_TEAM_ID; // Optional
    
    // Validate required environment variables
    if (!process.env.VERCEL_ACCESS_TOKEN) {
      throw new Error('VERCEL_ACCESS_TOKEN is required');
    }
    // VERCEL_TEAM_ID is now optional
  }

  /**
   * Get all blobs from the store
   * @returns {Promise<Array>} Array of blob objects
   */
  async getAllBlobs() {
    try {
       // Try with different prefix configurations
       const prefixOptions = [
         `${this.rootFolder}/`,    // With trailing slash
         this.rootFolder,          // Without trailing slash
         ''                        // No prefix (get all)
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
      
       // If no blobs found with any prefix, try without teamId
       if (blobs.length === 0 && this.teamId) {
         try {
           // Trying without teamId
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
      
      // Provide more specific error information
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

  /**
   * Get blobs from a specific folder
   * @param {string} folderName - The folder name (item number)
   * @returns {Promise<Object>} Folder data with files
   */
  async getBlobsByFolder(folderName) {
    try {
      // Fetching blobs for folder: ${folderName}
      
      // Try different prefix formats for folder access
      const prefixOptions = [
                 `${folderName}/`,  // With trailing slash
         folderName         // Without trailing slash
      ];
      
      let blobs = [];
      let lastError = null;
      
      for (const prefix of prefixOptions) {
        try {
          // Trying folder prefix: "${prefix}"
          
          const listOptions = {
            limit: 1000,
            prefix: prefix,
            token: process.env.VERCEL_ACCESS_TOKEN
          };
          
          // Add teamId if available
          if (this.teamId) {
            listOptions.teamId = this.teamId;
          }
          
          const result = await list(listOptions);
          blobs = result.blobs;
          
          // Found ${blobs.length} blobs in folder with prefix "${prefix}"
          
          if (blobs.length > 0) {
            break;
          }
        } catch (error) {
          // Failed with folder prefix "${prefix}": ${error.message}
          lastError = error;
          continue;
        }
      }
      
       // If still no blobs found, search all blobs for the folder
       if (blobs.length === 0) {
         // No blobs found with standard prefixes. Searching all blobs for folder ${folderName}
         try {
           const allBlobsResult = await list({
             limit: 1000,
             token: process.env.VERCEL_ACCESS_TOKEN,
             ...(this.teamId && { teamId: this.teamId })
           });
           
           // Filter blobs that belong to this folder
           blobs = allBlobsResult.blobs.filter(blob => {
             const pathParts = blob.pathname.split('/');
             return pathParts[0] === folderName || blob.pathname.startsWith(`${folderName}/`);
           });
          
          // Found ${blobs.length} blobs by searching all blobs
        } catch (error) {
          // Failed to search all blobs: ${error.message}
          lastError = error;
        }
      }
      
         if (blobs.length === 0) {
         // List available folders for debugging
         try {
           const allBlobsResult = await list({
             limit: 1000,
             token: process.env.VERCEL_ACCESS_TOKEN,
             ...(this.teamId && { teamId: this.teamId })
           });
           
           const availableFolders = [...new Set(allBlobsResult.blobs.map(blob => blob.pathname.split('/')[0]))];
           // Available folders: ${availableFolders.join(', ')}
           
           throw new Error(`Folder "${folderName}" not found. Available folders: ${availableFolders.join(', ')}`);
         } catch (debugError) {
           if (lastError) throw lastError;
           throw debugError;
         }
       }
      
      return this.processFolderBlobs(blobs, folderName);
    } catch (error) {
      console.error(`Error fetching blobs for folder ${folderName}:`, error);
      throw error;
    }
  }

  /**
   * Organize blobs by folder structure
   * @param {Array} blobs - Array of blob objects
   * @returns {Object} Organized blob data
   */
  organizeBlobsByFolder(blobs) {
    const folders = {};
    
    blobs.forEach(blob => {
      // Processing blob: ${blob.pathname}
      
      if (blob.pathname) {
        let pathParts;
        
        // Handle different path structures
        if (blob.pathname.startsWith(`${this.rootFolder}/`)) {
          // Remove root folder from path
          const relativePath = blob.pathname.substring(`${this.rootFolder}/`.length);
          pathParts = relativePath.split('/');
        } else {
          pathParts = blob.pathname.split('/');
        }
        
        if (pathParts.length >= 2) {
          const folderName = pathParts[0]; // Get the first part as folder name
          
          if (!folders[folderName]) {
            folders[folderName] = [];
          }
          
          folders[folderName].push({
            fileName: pathParts.slice(1).join('/'), // Rest of the path as filename
            fileUrl: blob.url,
            fileSize: this.formatFileSize(blob.size),
            contentType: blob.contentType,
            uploadedAt: blob.uploadedAt,
            fullPath: blob.pathname
          });
        } else {
          // Handle files in root
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

    // Convert to array format
    return Object.keys(folders).map(folderName => ({
      folderName,
      files: folders[folderName]
    }));
  }

  /**
   * Process blobs for a specific folder
   * @param {Array} blobs - Array of blob objects
   * @param {string} folderName - The folder name
   * @returns {Object} Folder data
   */
  processFolderBlobs(blobs, folderName) {
    const files = blobs.map(blob => ({
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

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Search blobs by filename or folder
   * @param {string} query - Search query
   * @returns {Promise<Array>} Search results
   */
  async searchBlobs(query) {
    try {
      const allBlobs = await this.getAllBlobs();
      const results = [];
      
      allBlobs.forEach(folder => {
        const matchingFiles = folder.files.filter(file => 
          file.fileName.toLowerCase().includes(query.toLowerCase()) ||
          folder.folderName.toLowerCase().includes(query.toLowerCase())
        );
        
        if (matchingFiles.length > 0) {
          results.push({
            folderName: folder.folderName,
            files: matchingFiles
          });
        }
      });
      
      return results;
    } catch (error) {
      console.error('Error searching blobs:', error);
      throw error;
    }
  }
}

module.exports = VercelBlobService;