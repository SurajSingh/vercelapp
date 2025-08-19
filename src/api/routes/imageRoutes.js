const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

/**
 * @swagger
 * /api/images/{folderName}/{imageName}:
 *   get:
 *     summary: Get a resized image by name within a folder
 *     description: Fetches and resizes a specific image from a folder with caching support. Returns direct image data by default (usable as image URL) or JSON metadata when format=json is specified.
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder name (item number)
 *       - in: path
 *         name: imageName
 *         required: true
 *         schema:
 *           type: string
 *         description: Specific image name to resize
 *       - in: query
 *         name: width
 *         required: false
 *         schema:
 *           type: integer
 *         description: Target width for resizing
 *       - in: query
 *         name: height
 *         required: false
 *         schema:
 *           type: integer
 *         description: Target height for resizing
 *       - in: query
 *         name: purgeCache
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Whether to ignore cache and process image from scratch
 *       - in: query
 *         name: format
 *         required: false
 *         schema:
 *           type: string
 *         description: Response format - 'json' for metadata, omit for direct image
 *     responses:
 *       200:
 *         description: Successfully retrieved resized image or metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     folderName:
 *                       type: string
 *                     imageName:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     fileUrl:
 *                       type: string
 *                     resizedUrl:
 *                       type: string
 *                     isResized:
 *                       type: boolean
 *                     isCached:
 *                       type: boolean
 *                     dimensions:
 *                       type: object
 *                     hasTransparency:
 *                       type: boolean
 *                     outputFormat:
 *                       type: string
 *           image/*:
 *             description: Direct image data when format parameter is not 'json'
 *       400:
 *         description: Bad request - missing required parameters
 *       404:
 *         description: Image not found
 *       500:
 *         description: Internal server error
 */
router.get('/:folderName/:imageName', imageController.getImage);

/**
 * @swagger
 * /api/images/{folderName}:
 *   get:
 *     summary: Get all images from a specific folder
 *     description: Fetches all images from a specific folder with optional resizing and caching support
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder name (item number)
 *       - in: query
 *         name: width
 *         required: false
 *         schema:
 *           type: integer
 *         description: Target width for resizing all images
 *       - in: query
 *         name: height
 *         required: false
 *         schema:
 *           type: integer
 *         description: Target height for resizing all images
 *       - in: query
 *         name: purgeCache
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Whether to ignore cache and process images from scratch
 *     responses:
 *       200:
 *         description: Successfully retrieved folder images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     folderName:
 *                       type: string
 *                     files:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileName:
 *                             type: string
 *                           fileUrl:
 *                             type: string
 *                           resizedUrl:
 *                             type: string
 *                           isResized:
 *                             type: boolean
 *                           isCached:
 *                             type: boolean
 *                           dimensions:
 *                             type: object
 *       400:
 *         description: Bad request - missing required parameters
 *       500:
 *         description: Internal server error
 */
router.get('/:folderName', imageController.getFolderImages);

module.exports = router;
