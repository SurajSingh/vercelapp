const express = require('express');
const router = express.Router();
const cacheController = require('../controllers/cacheController');

/**
 * @swagger
 * /api/cache:
 *   get:
 *     summary: Get cache statistics
 *     description: Returns cache statistics and information
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Clear image cache
 *     description: Clears the entire image cache or cache for a specific folder
 *     tags: [Cache Management]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               folderName:
 *                 type: string
 *                 description: Optional folder name to clear specific cache
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       500:
 *         description: Internal server error
 */
router.get('/', cacheController.getCacheStats);
router.post('/', cacheController.clearCache);

module.exports = router;
