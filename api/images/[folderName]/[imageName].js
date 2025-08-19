const { list } = require('@vercel/blob');
const sharp = require('sharp');

class SpecificImageService {
  constructor() {
    this.rootFolder = process.env.ROOT_FOLDER || 'Skeidar-Assets';
    this.teamId = process.env.VERCEL_TEAM_ID;
    
    if (!process.env.VERCEL_ACCESS_TOKEN) {
      throw new Error('VERCEL_ACCESS_TOKEN is required');
    }
  }

  async getSpecificImage(folderName, imageName) {
    try {
      const imagePath = `${folderName}/${imageName}`;
      
      const listOptions = {
        limit: 1000,
        prefix: imagePath,
        token: process.env.VERCEL_ACCESS_TOKEN
      };
      
      if (this.teamId) {
        listOptions.teamId = this.teamId;
      }
      
      const result = await list(listOptions);
      
      if (result.blobs.length === 0) {
        // Try alternative search methods
        const allBlobsResult = await list({
          limit: 1000,
          token: process.env.VERCEL_ACCESS_TOKEN,
          ...(this.teamId && { teamId: this.teamId })
        });
        
        const matchingBlobs = allBlobsResult.blobs.filter(blob => {
          return blob.pathname === imagePath || 
                 blob.pathname.endsWith(`/${imageName}`) ||
                 blob.pathname.includes(`/${folderName}/${imageName}`);
        });
        
        if (matchingBlobs.length === 0) {
          throw new Error(`Image "${imageName}" not found in folder "${folderName}"`);
        }
        
        return this.processSpecificImage(matchingBlobs[0], folderName, imageName);
      }
      
      return this.processSpecificImage(result.blobs[0], folderName, imageName);
    } catch (error) {
      throw error;
    }
  }

  processSpecificImage(blob, folderName, imageName) {
    return {
      fileName: imageName,
      fileUrl: blob.url,
      fileSize: this.formatFileSize(blob.size),
      contentType: blob.contentType,
      uploadedAt: blob.uploadedAt,
      fullPath: blob.pathname,
      folderName: folderName
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

  async processSingleImageWithRetry(file, folderName, width, height, backgroundColor = '#ffffff', retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.processSingleImage(file, folderName, width, height, backgroundColor);
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async processSingleImage(file, folderName, width, height, backgroundColor = '#ffffff') {
    try {
      // Download and process
      const imageBuffer = await this.downloadImage(file.fileUrl);
      const hasAlpha = await this.hasTransparency(imageBuffer);
      const outputFormat = this.determineOutputFormat(file.fileUrl, hasAlpha);
      
      // Resize with optimizations
      const resizedBuffer = await this.resizeImage(
        imageBuffer, width, height, outputFormat, hasAlpha, backgroundColor
      );
      
      return {
        buffer: resizedBuffer,
        format: outputFormat,
        mimeType: this.getMimeTypeForFormat(outputFormat),
        dimensions: { width, height }
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${error.message}`);
    }
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

let specificImageService;

const initializeServices = () => {
  if (!specificImageService) {
    specificImageService = new SpecificImageService();
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
    
    // Extract folderName and imageName from the URL path (without query parameters)
    const urlPath = req.url.split('?')[0]; // Remove query parameters
    const urlParts = urlPath.split('/');
    const imagesIndex = urlParts.indexOf('images');
    const folderName = urlParts[imagesIndex + 1];
    const imageName = urlParts[imagesIndex + 2];
    
    if (!folderName || !imageName) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL',
        message: 'Please provide both folder name and image name in the URL'
      });
    }
    
    const { width, height, quality, format, bg } = req.query;
    
    // Get the image data
    const imageData = await specificImageService.getSpecificImage(folderName, imageName);
    
    // If resize parameters are provided, process the image and return buffer
    if (width || height) {
      try {
        const processedImage = await specificImageService.processSingleImageWithRetry(
          imageData, 
          folderName, 
          parseInt(width) || undefined, 
          parseInt(height) || undefined, 
          bg || '#ffffff'
        );
        
        // Set appropriate headers for image response
        res.setHeader('Content-Type', processedImage.mimeType);
        res.setHeader('Content-Length', processedImage.buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Return the image buffer
        res.status(200).send(processedImage.buffer);
        return;
      } catch (error) {
        throw error;
      }
    }
    
    // If no resize parameters, return JSON metadata
    res.status(200).json({
      success: true,
      data: imageData,
      message: 'No resize parameters provided. Add ?width=X or ?height=Y to get resized image.'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};
