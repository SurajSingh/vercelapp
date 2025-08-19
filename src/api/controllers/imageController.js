const ImageResizeService = require('../../services/ImageResizeService');
const VercelBlobService = require('../../services/VercelBlobService');

let imageResizeService;
let vercelBlobService;

const initializeServices = () => {
  if (!imageResizeService) {
    imageResizeService = new ImageResizeService();
  }
  if (!vercelBlobService) {
    vercelBlobService = new VercelBlobService();
  }
};

const getImage = async (req, res) => {
  try {
    initializeServices();
    const { folderName, imageName } = req.params;
    const { width, height, purgeCache, format } = req.query;

    if (!width && !height) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Width or height parameter is required'
      });
    }

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

    const folderData = await vercelBlobService.getBlobsByFolder(folderName);

    if (!folderData || !folderData.files || folderData.files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: `No files found in folder: ${folderName}`
      });
    }

    const processedImage = await imageResizeService.processSingleImageByName(
      folderName,
      imageName,
      folderData.files,
      targetWidth,
      targetHeight,
      shouldPurgeCache
    );

    if (!processedImage.isResized) {
      return res.status(500).json({
        success: false,
        error: 'Processing failed',
        message: processedImage.error || 'Image processing failed'
      });
    }

    if (format === 'json') {
      return res.json({
        success: true,
        data: {
          imageName,
          folderName,
          resizedUrl: processedImage.resizedUrl,
          dimensions: processedImage.dimensions,
          outputFormat: processedImage.outputFormat,
          isCached: processedImage.isCached,
          resizeParams: { width: targetWidth, height: targetHeight }
        }
      });
    }

    const base64Data = processedImage.resizedUrl.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const mimeType = imageResizeService.getMimeTypeForFormat(processedImage.outputFormat);
    res.set({
      'Content-Type': mimeType,
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=3600',
      'ETag': `"${processedImage.isCached ? 'cached' : 'processed'}-${targetWidth}x${targetHeight}-${imageName}"`,
      'X-Image-Info': JSON.stringify({
        originalName: imageName,
        folderName: folderName,
        dimensions: processedImage.dimensions,
        outputFormat: processedImage.outputFormat,
        isCached: processedImage.isCached,
        resizeParams: { width: targetWidth, height: targetHeight }
      })
    });

    res.send(imageBuffer);

  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

const getFolderImages = async (req, res) => {
  try {
    initializeServices();
    const { folderName } = req.params;
    const { width, height, purgeCache } = req.query;

    const folderData = await vercelBlobService.getBlobsByFolder(folderName);

    if (!folderData || !folderData.files || folderData.files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: `No files found in folder: ${folderName}`
      });
    }

    if (!width && !height) {
      return res.json({
        success: true,
        data: {
          folderName,
          files: folderData.files,
          resizeParams: null
        },
        totalFiles: folderData.files.length
      });
    }

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

    const processedFiles = await imageResizeService.processFolderImages(
      folderData.files,
      folderName,
      targetWidth,
      targetHeight,
      shouldPurgeCache
    );

    res.json({
      success: true,
      data: {
        folderName,
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
    console.error('Error processing folder images:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

module.exports = {
  getImage,
  getFolderImages
};
