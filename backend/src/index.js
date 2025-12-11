require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const vnstatService = require('./services/vnstat');
const telegramService = require('./services/telegram');

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = process.env.BASE_PATH || '/';

app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../public');
  
  // Serve static files at base path
  app.use(BASE_PATH, express.static(staticPath));
  
  // Also serve at root for backwards compatibility
  if (BASE_PATH !== '/') {
    app.use(express.static(staticPath));
  }
}

// Create API router
const apiRouter = express.Router();

apiRouter.get('/traffic/summary', async (req, res) => {
  try {
    const data = await vnstatService.getSummary();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/traffic/hourly', async (req, res) => {
  try {
    const data = await vnstatService.getHourly();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/traffic/daily', async (req, res) => {
  try {
    const data = await vnstatService.getDaily();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/traffic/weekly', async (req, res) => {
  try {
    const data = await vnstatService.getWeekly();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/traffic/monthly', async (req, res) => {
  try {
    const data = await vnstatService.getMonthly();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/traffic/live', async (req, res) => {
  try {
    const data = await vnstatService.getLive();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/interfaces', async (req, res) => {
  try {
    const data = await vnstatService.getInterfaces();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount API router at both paths
app.use('/api', apiRouter);
if (BASE_PATH !== '/') {
  app.use(`${BASE_PATH}/api`, apiRouter);
}

// Initialize Telegram bot
telegramService.init();

// Daily report at 9:00 AM
cron.schedule(process.env.DAILY_REPORT_CRON || '0 9 * * *', async () => {
  console.log('Sending daily traffic report...');
  await telegramService.sendDailyReport();
});

// Weekly report on Monday at 9:00 AM
cron.schedule(process.env.WEEKLY_REPORT_CRON || '0 9 * * 1', async () => {
  console.log('Sending weekly traffic report...');
  await telegramService.sendWeeklyReport();
});

// Monthly report on 1st of each month at 9:00 AM
cron.schedule(process.env.MONTHLY_REPORT_CRON || '0 9 1 * *', async () => {
  console.log('Sending monthly traffic report...');
  await telegramService.sendMonthlyReport();
});

// Alert check every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await telegramService.checkThresholds();
});

// Serve frontend in production (SPA fallback)
if (process.env.NODE_ENV === 'production') {
  const indexFile = path.join(__dirname, '../public/index.html');
  
  const spaFallback = (req, res) => {
    // Don't serve index.html for static asset or API requests
    const ext = path.extname(req.path);
    if (ext && ext !== '.html') {
      return res.status(404).send('Not found');
    }
    res.sendFile(indexFile);
  };
  
  // Handle SPA routes at base path
  app.get(`${BASE_PATH}*`, spaFallback);
  
  // Also handle root for backwards compatibility
  if (BASE_PATH !== '/') {
    app.get('*', spaFallback);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Traffic Watcher API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

