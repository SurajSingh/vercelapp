const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vercel Blobs Image API',
      version: '1.0.0',
      description: 'API for managing and resizing images stored in Vercel Blobs'
    },
    servers: [
      {
        url: 'https://vercelapp-liart-nu.vercel.app',
        description: 'Production server'
      }
    ]
  },
  apis: [
    // Include the current file for the health endpoint documentation
    path.join(__dirname, 'docs.js'),
    // Add other API files if they exist in the serverless environment
    path.join(__dirname, 'blobs.js'),
    path.join(__dirname, 'health.js'),
    path.join(__dirname, 'search.js'),
    path.join(__dirname, 'cache.js'),
    path.join(__dirname, 'images', '*.js')
  ]
};

// Generate specs with error handling
let specs;
try {
  specs = swaggerJsdoc(swaggerOptions);
} catch (error) {
  console.error('Error generating Swagger specs:', error);
  // Fallback specs if generation fails
  specs = {
    openapi: '3.0.0',
    info: {
      title: 'Vercel Blobs Image API',
      version: '1.0.0',
      description: 'API for managing and resizing images stored in Vercel Blobs'
    },
    paths: {
      '/api/health': {
        get: {
          summary: 'Health check endpoint',
          description: 'Returns the current health status and timestamp of the API',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'API is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'OK'
                      },
                      timestamp: {
                        type: 'string',
                        format: 'date-time',
                        example: '2025-08-14T06:45:37.123Z'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current health status and timestamp of the API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-08-14T06:45:37.123Z"
 */

/**
 * @swagger
 * /api/blobs:
 *   get:
 *     summary: Get all blob files
 *     description: Fetches all files from the blob storage
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/blobs/{folderName}:
 *   get:
 *     summary: Get files from a specific folder
 *     description: Fetches all files from a specific folder
 *     tags: [Blobs]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the folder
 *     responses:
 *       200:
 *         description: Successfully retrieved folder files
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/images/{folderName}:
 *   get:
 *     summary: Get all images from a folder
 *     description: Fetches all images from a specific folder with optional resizing
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder name
 *       - in: query
 *         name: width
 *         schema:
 *           type: integer
 *         description: Target width for resizing
 *       - in: query
 *         name: height
 *         schema:
 *           type: integer
 *         description: Target height for resizing
 *     responses:
 *       200:
 *         description: Successfully retrieved images
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/images/{folderName}/{imageName}:
 *   get:
 *     summary: Get a specific resized image
 *     description: Fetches and resizes a specific image from a folder
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: folderName
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder name
 *       - in: path
 *         name: imageName
 *         required: true
 *         schema:
 *           type: string
 *         description: Image name
 *       - in: query
 *         name: width
 *         schema:
 *           type: integer
 *         description: Target width
 *       - in: query
 *         name: height
 *         schema:
 *           type: integer
 *         description: Target height
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *         description: Response format (json for metadata)
 *     responses:
 *       200:
 *         description: Successfully retrieved image
 *       404:
 *         description: Image not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search blobs
 *     description: Search for files or folders containing the specified query
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Successfully retrieved search results
 *       500:
 *         description: Internal server error
 */

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

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname === '/api-docs.json') {
    res.setHeader('Content-Type', 'application/json');
    return res.send(specs);
  }

  // Serve the main docs page with embedded Swagger UI
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vercel Blobs API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
        .swagger-ui .topbar { display: none; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api-docs.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
