require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const vnstatService = require('./services/vnstat');
const telegramService = require('./services/telegram');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../public');
  const basePath = process.env.BASE_PATH || '/';
  
  // Serve static files at base path
  app.use(basePath, express.static(staticPath));
  
  // Also serve at root for backwards compatibility
  if (basePath !== '/') {
    app.use(express.static(staticPath));
  }
}

// API Routes
app.get('/api/traffic/summary', async (req, res) => {
  try {
    const data = await vnstatService.getSummary();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/traffic/hourly', async (req, res) => {
  try {
    const data = await vnstatService.getHourly();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/traffic/daily', async (req, res) => {
  try {
    const data = await vnstatService.getDaily();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/traffic/weekly', async (req, res) => {
  try {
    const data = await vnstatService.getWeekly();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/traffic/monthly', async (req, res) => {
  try {
    const data = await vnstatService.getMonthly();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/traffic/live', async (req, res) => {
  try {
    const data = await vnstatService.getLive();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/interfaces', async (req, res) => {
  try {
    const data = await vnstatService.getInterfaces();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
  const basePath = process.env.BASE_PATH || '/';
  const indexFile = path.join(__dirname, '../public/index.html');
  
  const spaFallback = (req, res) => {
    // Don't serve index.html for static asset requests
    const ext = path.extname(req.path);
    if (ext && ext !== '.html') {
      return res.status(404).send('Not found');
    }
    res.sendFile(indexFile);
  };
  
  // Handle SPA routes at base path
  app.get(`${basePath}*`, spaFallback);
  
  // Also handle root for backwards compatibility
  if (basePath !== '/') {
    app.get('*', spaFallback);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Traffic Watcher API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

