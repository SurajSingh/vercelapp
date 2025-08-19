const swaggerJsdoc = require('swagger-jsdoc');

// Define the Swagger specification directly
const swaggerSpec = {
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
  ],
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
    },
    '/api/blobs': {
      get: {
        summary: 'Get all blob files',
        description: 'Fetches all files from the blob storage',
        tags: ['Blobs'],
        responses: {
          '200': {
            description: 'Successfully retrieved blob files',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          folderName: {
                            type: 'string'
                          },
                          files: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                fileName: {
                                  type: 'string'
                                },
                                fileUrl: {
                                  type: 'string'
                                },
                                fileSize: {
                                  type: 'string'
                                },
                                contentType: {
                                  type: 'string'
                                },
                                uploadedAt: {
                                  type: 'string',
                                  format: 'date-time'
                                }
                              }
                            }
                          }
                        }
                      }
                    },
                    totalFolders: {
                      type: 'integer'
                    },
                    totalFiles: {
                      type: 'integer'
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error'
          }
        }
      }
    },
    '/api/blobs/{folderName}': {
      get: {
        summary: 'Get files from a specific folder',
        description: 'Fetches all files from a specific folder',
        tags: ['Blobs'],
        parameters: [
          {
            in: 'path',
            name: 'folderName',
            required: true,
            schema: {
              type: 'string'
            },
            description: 'Name of the folder'
          }
        ],
        responses: {
          '200': {
            description: 'Successfully retrieved folder files',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      type: 'object',
                      properties: {
                        folderName: {
                          type: 'string'
                        },
                        files: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              fileName: {
                                type: 'string'
                              },
                              fileUrl: {
                                type: 'string'
                              },
                              fileSize: {
                                type: 'string'
                              },
                              contentType: {
                                type: 'string'
                              },
                              uploadedAt: {
                                type: 'string',
                                format: 'date-time'
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
          },
          '404': {
            description: 'Folder not found'
          },
          '500': {
            description: 'Internal server error'
          }
        }
      }
    },
    '/api/images/{folderName}': {
      get: {
        summary: 'Get all images from a folder',
        description: 'Fetches all images from a specific folder with optional resizing',
        tags: ['Images'],
        parameters: [
          {
            in: 'path',
            name: 'folderName',
            required: true,
            schema: {
              type: 'string'
            },
            description: 'Folder name'
          },
          {
            in: 'query',
            name: 'width',
            schema: {
              type: 'integer'
            },
            description: 'Target width for resizing'
          },
          {
            in: 'query',
            name: 'height',
            schema: {
              type: 'integer'
            },
            description: 'Target height for resizing'
          },
          {
            in: 'query',
            name: 'purgeCache',
            schema: {
              type: 'boolean'
            },
            description: 'Whether to ignore cache and process images from scratch'
          }
        ],
        responses: {
          '200': {
            description: 'Successfully retrieved images',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      type: 'object',
                      properties: {
                        folderName: {
                          type: 'string'
                        },
                        files: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              fileName: {
                                type: 'string'
                              },
                              fileUrl: {
                                type: 'string'
                              },
                              resizedUrl: {
                                type: 'string'
                              },
                              isResized: {
                                type: 'boolean'
                              },
                              isCached: {
                                type: 'boolean'
                              },
                              dimensions: {
                                type: 'object',
                                properties: {
                                  width: {
                                    type: 'integer'
                                  },
                                  height: {
                                    type: 'integer'
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
              }
            }
          },
          '404': {
            description: 'Folder not found'
          },
          '500': {
            description: 'Internal server error'
          }
        }
      }
    },
    '/api/images/{folderName}/{imageName}': {
      get: {
        summary: 'Get a specific resized image',
        description: 'Fetches and resizes a specific image from a folder',
        tags: ['Images'],
        parameters: [
          {
            in: 'path',
            name: 'folderName',
            required: true,
            schema: {
              type: 'string'
            },
            description: 'Folder name'
          },
          {
            in: 'path',
            name: 'imageName',
            required: true,
            schema: {
              type: 'string'
            },
            description: 'Image name'
          },
          {
            in: 'query',
            name: 'width',
            schema: {
              type: 'integer'
            },
            description: 'Target width'
          },
          {
            in: 'query',
            name: 'height',
            schema: {
              type: 'integer'
            },
            description: 'Target height'
          },
          {
            in: 'query',
            name: 'purgeCache',
            schema: {
              type: 'boolean'
            },
            description: 'Whether to ignore cache'
          },
          {
            in: 'query',
            name: 'format',
            schema: {
              type: 'string',
              enum: ['json']
            },
            description: 'Response format - json for metadata, omit for direct image'
          }
        ],
        responses: {
          '200': {
            description: 'Successfully retrieved image',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      type: 'object',
                      properties: {
                        imageName: {
                          type: 'string'
                        },
                        folderName: {
                          type: 'string'
                        },
                        resizedUrl: {
                          type: 'string'
                        },
                        dimensions: {
                          type: 'object',
                          properties: {
                            width: {
                              type: 'integer'
                            },
                            height: {
                              type: 'integer'
                            }
                          }
                        },
                        outputFormat: {
                          type: 'string'
                        },
                        isCached: {
                          type: 'boolean'
                        }
                      }
                    }
                  }
                }
              },
              'image/*': {
                description: 'Direct image data when format parameter is not json'
              }
            }
          },
          '400': {
            description: 'Bad request - missing required parameters'
          },
          '404': {
            description: 'Image not found'
          },
          '500': {
            description: 'Internal server error'
          }
        }
      }
    },
    '/api/search': {
      get: {
        summary: 'Search blobs',
        description: 'Search for files or folders containing the specified query',
        tags: ['Search'],
        parameters: [
          {
            in: 'query',
            name: 'q',
            required: true,
            schema: {
              type: 'string'
            },
            description: 'Search query'
          }
        ],
        responses: {
          '200': {
            description: 'Successfully retrieved search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          folderName: {
                            type: 'string'
                          },
                          files: {
                            type: 'array',
                            items: {
                              type: 'object'
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error'
          }
        }
      }
    },
    '/api/cache': {
      get: {
        summary: 'Get cache statistics',
        description: 'Returns cache statistics and information',
        tags: ['Cache Management'],
        responses: {
          '200': {
            description: 'Cache statistics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    data: {
                      type: 'object',
                      properties: {
                        keys: {
                          type: 'integer'
                        },
                        hits: {
                          type: 'integer'
                        },
                        misses: {
                          type: 'integer'
                        },
                        hitRate: {
                          type: 'number'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error'
          }
        }
      },
      post: {
        summary: 'Clear image cache',
        description: 'Clears the entire image cache or cache for a specific folder',
        tags: ['Cache Management'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  folderName: {
                    type: 'string',
                    description: 'Optional folder name to clear specific cache'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Cache cleared successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean'
                    },
                    message: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal server error'
          }
        }
      }
    }
  }
};

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

  // Handle JSON specification request
  if (pathname === '/api-docs.json') {
    res.setHeader('Content-Type', 'application/json');
    return res.send(swaggerSpec);
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
                spec: ${JSON.stringify(swaggerSpec)},
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
