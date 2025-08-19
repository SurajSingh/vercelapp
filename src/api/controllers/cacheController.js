const ImageResizeService = require('../../services/ImageResizeService');

let imageResizeService;

const initializeServices = () => {
  if (!imageResizeService) {
    imageResizeService = new ImageResizeService();
  }
};

const getCacheStats = async (req, res) => {
  try {
    initializeServices();
    const stats = imageResizeService.getCacheStats();
    const performance = imageResizeService.getPerformanceStats();

    res.json({
      success: true,
      data: {
        cache: stats,
        performance: performance
      }
    });

  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

const clearCache = async (req, res) => {
  try {
    initializeServices();
    const { folderName } = req.body;

    if (folderName) {
      imageResizeService.clearFolderCache(folderName);
      res.json({
        success: true,
        message: `Cache cleared for folder: ${folderName}`
      });
    } else {
      imageResizeService.clearAllCache();
      res.json({
        success: true,
        message: 'All cache cleared'
      });
    }

  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

module.exports = {
  getCacheStats,
  clearCache
};
