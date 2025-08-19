const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search blobs by filename or folder name
 *     description: Search for files or folders containing the specified query
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query for filename or folder
 *     responses:
 *       200:
 *         description: Successfully retrieved search results
 *       500:
 *         description: Internal server error
 */
router.get('/', searchController.search);

module.exports = router;
