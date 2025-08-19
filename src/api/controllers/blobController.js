const VercelBlobService = require('../../services/VercelBlobService');

let vercelBlobService;

const initializeServices = () => {
  if (!vercelBlobService) {
    vercelBlobService = new VercelBlobService();
  }
};

/**
 * Get all blobs from all folders
 */
const getAllBlobs = async (req, res) => {
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
      error: 'Failed to fetch blobs',
      message: error.message
    });
  }
};

/**
 * Get blobs from a specific folder
 */
const getBlobsByFolder = async (req, res) => {
  try {
    const { folderName } = req.params;
    
    if (!folderName) {
      return res.status(400).json({
        success: false,
        error: 'Folder name is required'
      });
    }

    initializeServices();
    const blobs = await vercelBlobService.getBlobsByFolder(folderName);
    
    if (!blobs || blobs.files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Folder not found'
      });
    }

    res.status(200).json({
      success: true,
      data: blobs
    });
  } catch (error) {
    console.error('Error fetching folder blobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch folder blobs',
      message: error.message
    });
  }
};

module.exports = {
  getAllBlobs,
  getBlobsByFolder
};
