const { list } = require('@vercel/blob');
const sharp = require('sharp');

class ImageService {
  constructor() {
    this.rootFolder = process.env.ROOT_FOLDER || 'Skeidar-Assets';
    this.teamId = process.env.VERCEL_TEAM_ID;
    
    if (!process.env.VERCEL_ACCESS_TOKEN) {
      throw new Error('VERCEL_ACCESS_TOKEN is required');
    }
  }

  async getImagesByFolder(folderName) {
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
        throw new Error(`No images found in folder: ${folderName}`);
      }
      
      return this.processImages(blobs, folderName);
    } catch (error) {
      console.error(`Error fetching images for folder ${folderName}:`, error);
      throw error;
    }
  }

  processImages(blobs, folderName) {
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

  async downloadImage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async hasTransparency(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return metadata.channels === 4; // RGBA has 4 channels
    } catch (error) {
      return false; // Assume no transparency on error
    }
  }

  determineOutputFormat(originalUrl, hasAlpha) {
    const ext = originalUrl.split('.').pop()?.toLowerCase();
    
    if (hasAlpha && ext !== 'png' && ext !== 'webp') {
      return 'png'; // Preserve transparency
    }
    
    if (ext === 'jpg' || ext === 'jpeg') {
      return 'jpeg';
    } else if (ext === 'png') {
      return 'png';
    } else if (ext === 'webp') {
      return 'webp';
    }
    
    return hasAlpha ? 'png' : 'jpeg';
  }

  parseBackgroundColor(backgroundColor) {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    return { r, g, b };
  }

  async processSingleImage(file, folderName, width, height, backgroundColor = '#ffffff') {
    if (!this.isSupportedFormat(file.fileUrl)) {
      return {
        ...file,
        resizedUrl: null,
        isResized: false,
        message: 'Unsupported format'
      };
    }

    try {
      // Download and process
      const imageBuffer = await this.downloadImage(file.fileUrl);
      const hasAlpha = await this.hasTransparency(imageBuffer);
      const outputFormat = this.determineOutputFormat(file.fileUrl, hasAlpha);
      
      // Resize with optimizations
      const resizedBuffer = await this.resizeImage(
        imageBuffer, width, height, outputFormat, hasAlpha, backgroundColor
      );
      
      // Get metadata efficiently
      const { width: finalWidth, height: finalHeight } = await sharp(resizedBuffer).metadata();
      
      return {
        ...file,
        resizedUrl: `data:${this.getMimeTypeForFormat(outputFormat)};base64,${resizedBuffer.toString('base64')}`,
        isResized: true,
        isCached: false,
        dimensions: { width: finalWidth, height: finalHeight },
        hasTransparency: hasAlpha,
        outputFormat
      };
    } catch (error) {
      return {
        ...file,
        resizedUrl: null,
        isResized: false,
        error: error.message
      };
    }
  }

  async processFolderImages(files, folderName, width, height, purgeCache = false, backgroundColor = '#ffffff') {
    const processedFiles = [];
    const toProcess = [];
    
    // First pass: check cache and filter files
    for (const file of files) {
      if (file.fileName === '') continue; // Skip folder entries
      
      const cacheKey = this.generateCacheKey(folderName, width, height, file.fileUrl);
      
      if (!purgeCache && this.cache && this.cache.has(cacheKey)) {
        const cachedData = this.cache.get(cacheKey);
        processedFiles.push({
          ...file,
          resizedUrl: cachedData.dataUrl,
          isResized: true,
          isCached: true,
          dimensions: cachedData.dimensions,
          hasTransparency: cachedData.hasTransparency,
          outputFormat: cachedData.outputFormat
        });
      } else {
        toProcess.push(file);
      }
    }

    if (toProcess.length === 0) {
      return processedFiles;
    }

    // Process images with concurrency control
    const batchSize = 3; // Process 3 images at a time
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      const batchPromises = batch.map(file => 
        this.processSingleImage(file, folderName, width, height, backgroundColor)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          processedFiles.push(result.value);
          
          // Cache successful results
          if (result.value.isResized && result.value.resizedUrl && this.cache) {
            const cacheKey = this.generateCacheKey(folderName, width, height, result.value.fileUrl);
            this.cache.set(cacheKey, {
              dataUrl: result.value.resizedUrl,
              dimensions: result.value.dimensions,
              hasTransparency: result.value.hasTransparency,
              outputFormat: result.value.outputFormat,
              timestamp: Date.now()
            });
          }
        } else {
          // Add a failed result
          processedFiles.push({
            ...batch[processedFiles.length],
            resizedUrl: null,
            isResized: false,
            error: result.reason?.message || 'Processing failed'
          });
        }
      }
      
      // Small delay to prevent overwhelming the system
      if (i + batchSize < toProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return processedFiles;
  }

  generateCacheKey(folderName, width, height, fileUrl) {
    return `${folderName}_${width}x${height}_${fileUrl}`;
  }

  isSupportedFormat(fileUrl) {
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = fileUrl.toLowerCase().split('.').pop();
    return supportedExtensions.includes(`.${ext}`);
  }

  async resizeImage(imageBuffer, width, height, format, hasAlpha, backgroundColor = '#ffffff') {
    try {
      let pipeline = sharp(imageBuffer, {
        limitInputPixels: false,
        sequentialRead: true,
        density: 72
      });
      
      // Resize configuration
      if (width || height) {
        pipeline = pipeline.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3
        });
      }

      // Background handling for transparency
      const bgColor = this.parseBackgroundColor(backgroundColor);

      // Format-specific optimizations
      switch (format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          if (hasAlpha) {
            pipeline = pipeline.flatten({ background: bgColor });
          }
          return await pipeline
            .jpeg({ 
              quality: 85, 
              progressive: true,
              mozjpeg: true
            })
            .toBuffer();
          
        case 'png':
          return await pipeline
            .png({ 
              compressionLevel: 6,
              palette: hasAlpha ? false : true,
              effort: 7
            })
            .toBuffer();
          
        case 'webp':
          return await pipeline
            .webp({ 
              quality: 85,
              effort: 4,
              smartSubsample: true
            })
            .toBuffer();
          
        default:
          if (hasAlpha) {
            return await pipeline.png({ compressionLevel: 6 }).toBuffer();
          } else {
            return await pipeline.jpeg({ quality: 85, progressive: true }).toBuffer();
          }
      }
    } catch (error) {
      throw new Error(`Resize failed: ${error.message}`);
    }
  }

  getMimeTypeForFormat(format) {
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp'
    };
    return mimeTypes[format.toLowerCase()] || 'image/jpeg';
  }
}

let imageService;
let cache = new Map(); // Simple in-memory cache

const initializeServices = () => {
  if (!imageService) {
    imageService = new ImageService();
    imageService.cache = cache; // Attach cache to service
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
    const folderNameIndex = urlParts.indexOf('images') + 1;
    const folderName = urlParts[folderNameIndex];
    
    if (!folderName) {
      return res.status(400).json({
        success: false,
        error: 'Folder name required',
        message: 'Please provide a folder name in the URL'
      });
    }
    
    const { width, height, purgeCache, bg } = req.query;
    
    // Get folder data
    const folderData = await imageService.getImagesByFolder(folderName);
    
    if (!folderData.files || folderData.files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found',
        message: `No images found in folder: ${folderName}`
      });
    }

    // If no resize parameters, return basic folder data
    if (!width && !height) {
      return res.json({
        success: true,
        data: {
          folderName: folderData.folderName,
          files: folderData.files,
          resizeParams: null
        },
        totalFiles: folderData.files.length
      });
    }

    // Validate resize parameters
    const targetWidth = width ? parseInt(width) : null;
    const targetHeight = height ? parseInt(height) : null;
    const shouldPurgeCache = purgeCache === 'true';

    if ((targetWidth && targetWidth <= 0) || (targetHeight && targetHeight <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Width and height must be positive numbers'
      });
    }

    // Process images with actual resizing
    const processedFiles = await imageService.processFolderImages(
      folderData.files,
      folderData.folderName,
      targetWidth,
      targetHeight,
      shouldPurgeCache,
      bg || '#ffffff'
    );

    // Return processed results
    res.json({
      success: true,
      data: {
        folderName: folderData.folderName,
        files: processedFiles,
        resizeParams: {
          width: targetWidth,
          height: targetHeight,
          purgeCache: shouldPurgeCache
        }
      },
      totalFiles: processedFiles.length,
      resizedFiles: processedFiles.filter(f => f.isResized).length,
      cachedFiles: processedFiles.filter(f => f.isCached).length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};
