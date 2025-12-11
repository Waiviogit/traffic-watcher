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
  app.use(express.static(path.join(__dirname, '../public')));
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

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Traffic Watcher API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

