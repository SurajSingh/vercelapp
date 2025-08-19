const VercelBlobService = require('../../services/VercelBlobService');

let vercelBlobService;

const initializeServices = () => {
  if (!vercelBlobService) {
    vercelBlobService = new VercelBlobService();
  }
};

const search = async (req, res) => {
  try {
    initializeServices();
    const { q: query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Search query parameter "q" is required'
      });
    }

    const results = await vercelBlobService.searchBlobs(query.trim());

    res.json({
      success: true,
      data: results,
      totalFolders: results.length,
      totalFiles: results.reduce((sum, folder) => sum + folder.files.length, 0),
      query: query.trim()
    });

  } catch (error) {
    console.error('Error searching blobs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

module.exports = {
  search
};
