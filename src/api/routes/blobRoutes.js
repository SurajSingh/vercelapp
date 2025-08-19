const express = require('express');
const router = express.Router();
const blobController = require('../controllers/blobController');

/**
 * @swagger
 * /api/blobs:
 *   get:
 *     summary: Get all blob files from Skeidar-Assets folder
 *     description: Fetches all files from the Skeidar-Assets root folder and its subfolders
 *     tags: [Blobs]
 *     responses:
 *       200:
 *         description: Successfully retrieved blob files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       folderName:
 *                         type: string
 *                         example: "000002"
 *                       files:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             fileName:
 *                               type: string
 *                               example: "banner-o.webp"
 *                             fileUrl:
 *                               type: string
 *                               example: "https://example.com/blob/000002/banner-o.webp"
 *                             fileSize:
 *                               type: string
 *                               example: "12.34 KB"
 *                             contentType:
 *                               type: string
 *                               example: "image/webp"
 *                             uploadedAt:
 *                               type: string
 *                               format: date-time
 *                               example: "2025-08-14T06:45:37.123Z"
 *                 totalFolders:
 *                   type: number
 *                   example: 5
 *                 totalFiles:
 *                   type: number
 *                   example: 25
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch blobs"
 */
router.get('/', blobController.getAllBlobs);

/**
 * @swagger
 * /api/blobs/{folderName}:
 *   get:
 *     summary: Get all files from a specific folder
 *     description: Fetches all files from a specific folder within the Skeidar-Assets directory
 *     tags: [Blobs]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the folder to fetch files from
 *     responses:
 *       200:
 *         description: Successfully retrieved folder files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     folderName:
 *                       type: string
 *                       example: "000002"
 *                     files:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileName:
 *                             type: string
 *                             example: "banner-o.webp"
 *                           fileUrl:
 *                             type: string
 *                             example: "https://example.com/blob/000002/banner-o.webp"
 *                           fileSize:
 *                             type: string
 *                             example: "12.34 KB"
 *                           contentType:
 *                             type: string
 *                             example: "image/webp"
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-08-14T06:45:37.123Z"
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Folder not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch folder blobs"
 */
router.get('/:folderName', blobController.getBlobsByFolder);

module.exports = router;
