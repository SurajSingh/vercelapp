// Simple in-memory cache for Vercel (note: this resets on each function invocation)
let cacheStats = {
  hits: 0,
  misses: 0,
  total: 0,
  lastCleared: new Date().toISOString()
};

let cache = new Map();

class CacheService {
  constructor() {
    this.cache = cache;
    this.stats = cacheStats;
  }

  get(key) {
    const item = this.cache.get(key);
    if (item && item.expiry > Date.now()) {
      this.stats.hits++;
      this.stats.total++;
      return item.value;
    } else if (item) {
      // Expired, remove it
      this.cache.delete(key);
    }
    this.stats.misses++;
    this.stats.total++;
    return null;
  }

  set(key, value, ttl = 300000) { // 5 minutes default TTL
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  clear() {
    const clearedCount = this.cache.size;
    this.cache.clear();
    this.stats.lastCleared = new Date().toISOString();
    return clearedCount;
  }

  getStats() {
    return {
      ...this.stats,
      currentSize: this.cache.size,
      memoryUsage: process.memoryUsage()
    };
  }
}

let cacheService;

const initializeServices = () => {
  if (!cacheService) {
    cacheService = new CacheService();
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

  try {
    initializeServices();
    
    if (req.method === 'GET') {
      const stats = cacheService.getStats();
      res.status(200).json({
        success: true,
        data: stats
      });
    } else if (req.method === 'DELETE') {
      const cleared = cacheService.clear();
      res.status(200).json({
        success: true,
        message: 'Cache cleared successfully',
        data: { cleared }
      });
    } else if (req.method === 'POST') {
      // Handle cache operations like clearing specific folders
      const { folderName } = req.body;
      if (folderName) {
        // Clear cache for specific folder
        let cleared = 0;
        for (const [key] of cacheService.cache) {
          if (key.includes(folderName)) {
            cacheService.cache.delete(key);
            cleared++;
          }
        }
        res.status(200).json({
          success: true,
          message: `Cache cleared for folder: ${folderName}`,
          data: { cleared }
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Folder name required',
          message: 'Please provide folderName in request body'
        });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};
