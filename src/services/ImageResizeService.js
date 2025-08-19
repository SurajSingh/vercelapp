const sharp = require('sharp');
const NodeCache = require('node-cache');
const https = require('https');
const http = require('http');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const path = require('path');

class ImageResizeService {
  constructor(options = {}) {
    // Cache configuration: 1 hour TTL, check for expired keys every 30 minutes
    this.cache = new NodeCache({ 
      stdTTL: 3600, // 1 hour
      checkperiod: 1800, // 30 minutes
      useClones: false
    });
    
    // Performance options
    this.maxConcurrent = options.maxConcurrent || Math.min(os.cpus().length * 2, 16);
    this.batchSize = options.batchSize || 10;
    this.enableWorkerThreads = options.enableWorkerThreads !== false; // Default true
    this.downloadTimeout = options.downloadTimeout || 15000; // Reduced to 15s
    this.useStreaming = options.useStreaming !== false; // Default true
    
    // Supported image formats
    this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff'];
    
    // Connection pools for HTTP requests
    this.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: this.maxConcurrent,
      maxFreeSockets: 10,
      timeout: this.downloadTimeout
    });
    
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: this.maxConcurrent,
      maxFreeSockets: 10,
      timeout: this.downloadTimeout
    });

    // Sharp configuration for performance
    sharp.concurrency(Math.min(os.cpus().length, 4)); // Limit Sharp threads
    sharp.cache(false); // Disable Sharp's cache to save memory
  }

  /**
   * Generate cache key for resized image
   * @param {string} folderName - Folder name
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {string} imageUrl - Original image URL
   * @returns {string} Cache key
   */
  generateCacheKey(folderName, width, height, imageUrl) {
    const urlHash = this.hashString(imageUrl);
    return `resize_${folderName}_${width}x${height}_${urlHash}`;
  }

  /**
   * Simple hash function for URLs (optimized)
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  /**
   * Check if image format is supported
   * @param {string} url - Image URL
   * @returns {boolean} True if supported
   */
  isSupportedFormat(url) {
    const lastDotIndex = url.lastIndexOf('.');
    if (lastDotIndex === -1) return false;
    const extension = url.substring(lastDotIndex + 1).toLowerCase();
    return this.supportedFormats.includes(extension);
  }

  /**
   * Download image from URL with optimizations
   * @param {string} url - Image URL
   * @returns {Promise<Buffer>} Image buffer
   */
  async downloadImage(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      const agent = url.startsWith('https:') ? this.httpsAgent : this.httpAgent;
      
      const request = protocol.get(url, { agent }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        // Pre-allocate buffer if content-length is available
        const contentLength = parseInt(response.headers['content-length'], 10);
        const chunks = contentLength ? [] : [];
        let receivedBytes = 0;

        response.on('data', (chunk) => {
          chunks.push(chunk);
          receivedBytes += chunk.length;
          
          // Safety check for very large files
          if (receivedBytes > 50 * 1024 * 1024) { // 50MB limit
            request.destroy();
            reject(new Error('File too large'));
          }
        });
        
        response.on('end', () => {
          try {
            resolve(Buffer.concat(chunks, receivedBytes));
          } catch (error) {
            reject(new Error('Buffer concat failed'));
          }
        });
        
        response.on('error', reject);
      });

      request.on('error', reject);
      request.setTimeout(this.downloadTimeout, () => {
        request.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  /**
   * Fast transparency check with metadata only
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<boolean>} True if image has transparency
   */
  async hasTransparency(imageBuffer) {
    try {
      // Use Sharp's fast metadata extraction
      const metadata = await sharp(imageBuffer, { 
        limitInputPixels: false,
        sequentialRead: true 
      }).metadata();
      
      return metadata.channels === 4 || metadata.hasAlpha || metadata.format === 'gif';
    } catch (error) {
      return false; // Assume no transparency on error
    }
  }

  /**
   * Determine optimal output format
   * @param {string} originalUrl - Original image URL
   * @param {boolean} hasAlpha - Whether image has transparency
   * @returns {string} Best output format
   */
  determineOutputFormat(originalUrl, hasAlpha) {
    const lastDotIndex = originalUrl.lastIndexOf('.');
    const originalFormat = lastDotIndex !== -1 ? 
      originalUrl.substring(lastDotIndex + 1).toLowerCase() : 'jpg';
    
    if (hasAlpha) {
      return originalFormat === 'webp' ? 'webp' : 'png';
    }
    
    return originalFormat === 'webp' ? 'webp' : 'jpeg';
  }

  /**
   * Optimized image resize with streaming
   * @param {Buffer} imageBuffer - Original image buffer
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {string} format - Output format
   * @param {boolean} hasAlpha - Whether image has transparency
   * @param {string} backgroundColor - Background color
   * @returns {Promise<Buffer>} Resized image buffer
   */
  async resizeImage(imageBuffer, width, height, format, hasAlpha, backgroundColor = '#ffffff') {
    try {
      let pipeline = sharp(imageBuffer, {
        limitInputPixels: false,
        sequentialRead: true,
        density: 72 // Optimize for web
      });
      
      // Resize configuration
      if (width || height) {
        pipeline = pipeline.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3 // Good balance of quality/speed
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
              mozjpeg: true // Use mozjpeg encoder if available
            })
            .toBuffer();
          
        case 'png':
          return await pipeline
            .png({ 
              compressionLevel: 6,
              palette: hasAlpha ? false : true, // Use palette for non-transparent
              effort: 7
            })
            .toBuffer();
          
        case 'webp':
          return await pipeline
            .webp({ 
              quality: 85,
              effort: 4, // Balance between speed and compression
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

  /**
   * Process single image (for worker threads)
   * @param {Object} file - File object
   * @param {string} folderName - Folder name
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {string} backgroundColor - Background color
   * @returns {Promise<Object>} Processed file
   */
  async processSingleImage(file, folderName, width, height, backgroundColor) {
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

  /**
   * Process images in batches with concurrency control
   * @param {Array} files - Array of file objects
   * @param {string} folderName - Folder name
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {boolean} purgeCache - Whether to ignore cache
   * @param {string} backgroundColor - Background color
   * @returns {Promise<Array>} Processed files
   */
  async processFolderImages(files, folderName, width, height, purgeCache = false, backgroundColor = '#ffffff') {
    const processedFiles = [];
    const toProcess = [];
    
    // First pass: check cache and filter files
    // Processing ${files.length} images with ${this.maxConcurrent} concurrent workers
    
    for (const file of files) {
      const cacheKey = this.generateCacheKey(folderName, width, height, file.fileUrl);
      
      if (!purgeCache && this.cache.has(cacheKey)) {
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

          // Cache hits: ${files.length - toProcess.length}, Processing: ${toProcess.length}

    if (toProcess.length === 0) {
      return processedFiles;
    }

    // Process in controlled batches
    const results = await this.processBatches(toProcess, folderName, width, height, backgroundColor);
    
    // Cache results and combine
    for (const result of results) {
      if (result.isResized && result.resizedUrl) {
        const cacheKey = this.generateCacheKey(folderName, width, height, result.fileUrl);
        this.cache.set(cacheKey, {
          dataUrl: result.resizedUrl,
          dimensions: result.dimensions,
          hasTransparency: result.hasTransparency,
          outputFormat: result.outputFormat,
          timestamp: Date.now()
        });
      }
      processedFiles.push(result);
    }

    return processedFiles;
  }

  /**
   * Process files in concurrent batches
   * @param {Array} files - Files to process
   * @param {string} folderName - Folder name
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {string} backgroundColor - Background color
   * @returns {Promise<Array>} Results
   */
  async processBatches(files, folderName, width, height, backgroundColor) {
    const results = [];
    
    // Process in batches to control memory usage
    for (let i = 0; i < files.length; i += this.batchSize) {
      const batch = files.slice(i, i + this.batchSize);
      const batchPromises = batch.map(file => 
        this.processSingleImageWithRetry(file, folderName, width, height, backgroundColor)
      );
      
      // Use Promise.allSettled to continue even if some images fail
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch processing error:', result.reason);
          // Add a failed result
          results.push({
            resizedUrl: null,
            isResized: false,
            error: result.reason?.message || 'Processing failed'
          });
        }
      }
      
              // Completed batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(files.length / this.batchSize)}
      
      // Small delay to prevent overwhelming the system
      if (i + this.batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  /**
   * Process single image with retry logic
   * @param {Object} file - File object
   * @param {string} folderName - Folder name
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {string} backgroundColor - Background color
   * @param {number} retries - Retry count
   * @returns {Promise<Object>} Processed file
   */
  async processSingleImageWithRetry(file, folderName, width, height, backgroundColor, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.processSingleImage(file, folderName, width, height, backgroundColor);
      } catch (error) {
        if (attempt === retries) {
          console.error(`Failed to process ${file.fileName} after ${retries + 1} attempts:`, error.message);
          return {
            ...file,
            resizedUrl: null,
            isResized: false,
            error: error.message
          };
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  /**
   * Process single image by name within a folder
   * @param {string} folderName - Folder name
   * @param {string} imageName - Specific image name
   * @param {Array} files - Array of files in the folder
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {boolean} purgeCache - Whether to ignore cache
   * @returns {Promise<Object>} Processed image result
   */
  async processSingleImageByName(folderName, imageName, files, width, height, purgeCache = false) {
    // Find the specific image in the folder
    const targetFile = files.find(file => file.fileName === imageName);
    
    if (!targetFile) {
      throw new Error(`Image "${imageName}" not found in folder "${folderName}"`);
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(folderName, width, height, targetFile.fileUrl);
    
    if (!purgeCache && this.cache.has(cacheKey)) {
      const cachedData = this.cache.get(cacheKey);
      return {
        ...targetFile,
        resizedUrl: cachedData.dataUrl,
        isResized: true,
        isCached: true,
        dimensions: cachedData.dimensions,
        hasTransparency: cachedData.hasTransparency,
        outputFormat: cachedData.outputFormat
      };
    }

    // Process the image
    const result = await this.processSingleImage(targetFile, folderName, width, height);
    
    // Cache the result if successful
    if (result.isResized && result.resizedUrl) {
      this.cache.set(cacheKey, {
        dataUrl: result.resizedUrl,
        dimensions: result.dimensions,
        hasTransparency: result.hasTransparency,
        outputFormat: result.outputFormat,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * Parse background color from hex string to Sharp color object
   * @param {string} backgroundColor - Background color in hex format
   * @returns {Object} Sharp color object
   */
  parseBackgroundColor(backgroundColor) {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    return { r, g, b };
  }

  /**
   * Get MIME type for format
   * @param {string} format - Image format
   * @returns {string} MIME type
   */
  getMimeTypeForFormat(format) {
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'tiff': 'image/tiff'
    };
    return mimeTypes[format.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Clear cache for specific folder
   * @param {string} folderName - Folder name
   */
  clearFolderCache(folderName) {
    const keys = this.cache.keys();
    const folderKeys = keys.filter(key => key.includes(`resize_${folderName}_`));
    
    folderKeys.forEach(key => this.cache.del(key));
    // Cleared cache for folder: ${folderName} (${folderKeys.length} keys)
  }

  /**
   * Clear entire cache
   */
  clearAllCache() {
    this.cache.flushAll();
    // All cache cleared
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    const stats = this.cache.getStats();
    return {
      keys: this.cache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
      keyspace: this.cache.keys().slice(0, 10) // First 10 keys for debugging
    };
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getPerformanceStats() {
    return {
      maxConcurrent: this.maxConcurrent,
      batchSize: this.batchSize,
      cpuCount: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB'
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.httpAgent?.destroy();
    this.httpsAgent?.destroy();
    this.cache.flushAll();
    sharp.cache(false);
  }
}

module.exports = ImageResizeService;