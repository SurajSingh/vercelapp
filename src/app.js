const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const path = require('path');

// Import route files
const imageRoutes = require('./api/routes/imageRoutes');
const searchRoutes = require('./api/routes/searchRoutes');
const cacheRoutes = require('./api/routes/cacheRoutes');
const blobRoutes = require('./api/routes/blobRoutes');
const healthRoutes = require('./api/routes/healthRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Development logging only
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} - ${duration} ms`);
    });
    next();
  });
}

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vercel Blobs Image API',
      version: '1.0.0',
      description: 'API for managing and resizing images stored in Vercel Blobs'
    },        
  },
  apis: [
    path.join(__dirname, 'api/routes/*.js'),
    path.join(__dirname, 'app.js')
  ]
};

const specs = swaggerJsdoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

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

// Set up routes
app.use('/api/health', healthRoutes);
app.use('/api/blobs', blobRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/cache', cacheRoutes);

module.exports = app;
