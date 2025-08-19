module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    message: 'Vercel deployment is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    envVars: {
      hasVercelToken: !!process.env.VERCEL_ACCESS_TOKEN,
      hasBaseUrl: !!process.env.BASE_URL,
      hasRootFolder: !!process.env.ROOT_FOLDER
    }
  });
};
