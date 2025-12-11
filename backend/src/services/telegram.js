const TelegramBot = require('node-telegram-bot-api');
const vnstatService = require('./vnstat');

let bot = null;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Thresholds in bytes (default 100GB daily, 500GB weekly, 2TB monthly)
const DAILY_THRESHOLD = parseInt(process.env.DAILY_THRESHOLD_GB || '100') * 1024 * 1024 * 1024;
const WEEKLY_THRESHOLD = parseInt(process.env.WEEKLY_THRESHOLD_GB || '500') * 1024 * 1024 * 1024;
const MONTHLY_THRESHOLD = parseInt(process.env.MONTHLY_THRESHOLD_GB || '2000') * 1024 * 1024 * 1024;

let lastAlertSent = {
  daily: null,
  weekly: null,
  monthly: null
};

const init = () => {
  if (!BOT_TOKEN) {
    console.log('Telegram bot token not configured, skipping initialization');
    return;
  }

  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log('Telegram bot initialized');

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
      `🚦 *Traffic Watcher Bot*\n\n` +
      `Your Chat ID: \`${chatId}\`\n\n` +
      `Commands:\n` +
      `/status - Current traffic summary\n` +
      `/today - Today's traffic\n` +
      `/week - This week's traffic\n` +
      `/month - This month's traffic\n` +
      `/live - Live bandwidth\n` +
      `/help - Show this help`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      `📊 *Traffic Watcher Commands*\n\n` +
      `/status - Overall traffic summary\n` +
      `/today - Today's traffic stats\n` +
      `/week - This week's traffic stats\n` +
      `/month - This month's traffic stats\n` +
      `/live - Current bandwidth usage\n` +
      `/thresholds - View alert thresholds`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const summary = await vnstatService.getSummary();
      bot.sendMessage(chatId,
        `📊 *Traffic Summary*\n\n` +
        `Interface: \`${summary.interface}\`\n\n` +
        `📥 Total RX: ${summary.traffic.total.rxFormatted}\n` +
        `📤 Total TX: ${summary.traffic.total.txFormatted}\n\n` +
        `Last updated: ${summary.updated.date.year}-${String(summary.updated.date.month).padStart(2, '0')}-${String(summary.updated.date.day).padStart(2, '0')} ${String(summary.updated.time.hour).padStart(2, '0')}:${String(summary.updated.time.minute).padStart(2, '0')}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });

  bot.onText(/\/today/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const today = await vnstatService.getTodayTraffic();
      const yesterday = await vnstatService.getYesterdayTraffic();
      
      const rxChange = yesterday.rx > 0 ? ((today.rx - yesterday.rx) / yesterday.rx * 100).toFixed(1) : 0;
      const txChange = yesterday.tx > 0 ? ((today.tx - yesterday.tx) / yesterday.tx * 100).toFixed(1) : 0;
      
      bot.sendMessage(chatId,
        `📅 *Today's Traffic*\n\n` +
        `📥 Download: ${today.rxFormatted} (${rxChange >= 0 ? '+' : ''}${rxChange}%)\n` +
        `📤 Upload: ${today.txFormatted} (${txChange >= 0 ? '+' : ''}${txChange}%)\n\n` +
        `📊 Yesterday: ↓${yesterday.rxFormatted} ↑${yesterday.txFormatted}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });

  bot.onText(/\/week/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const week = await vnstatService.getThisWeekTraffic();
      bot.sendMessage(chatId,
        `📆 *This Week's Traffic*\n\n` +
        `📥 Download: ${week.rxFormatted}\n` +
        `📤 Upload: ${week.txFormatted}\n` +
        `📊 Total: ${vnstatService.formatBytes(week.rx + week.tx)}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });

  bot.onText(/\/month/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const month = await vnstatService.getThisMonthTraffic();
      bot.sendMessage(chatId,
        `📅 *This Month's Traffic*\n\n` +
        `📥 Download: ${month.rxFormatted}\n` +
        `📤 Upload: ${month.txFormatted}\n` +
        `📊 Total: ${vnstatService.formatBytes(month.rx + month.tx)}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });

  bot.onText(/\/live/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      bot.sendMessage(chatId, '⏳ Measuring bandwidth (2 seconds)...');
      const live = await vnstatService.getLive();
      bot.sendMessage(chatId,
        `⚡ *Live Bandwidth*\n\n` +
        `📥 Download: ${live.rx}\n` +
        `📤 Upload: ${live.tx}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });

  bot.onText(/\/thresholds/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      `⚠️ *Alert Thresholds*\n\n` +
      `Daily: ${vnstatService.formatBytes(DAILY_THRESHOLD)}\n` +
      `Weekly: ${vnstatService.formatBytes(WEEKLY_THRESHOLD)}\n` +
      `Monthly: ${vnstatService.formatBytes(MONTHLY_THRESHOLD)}`,
      { parse_mode: 'Markdown' }
    );
  });
};

const sendMessage = async (message) => {
  if (!bot || !CHAT_ID) {
    console.log('Telegram not configured:', message);
    return;
  }
  
  try {
    await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Failed to send Telegram message:', error.message);
  }
};

const sendDailyReport = async () => {
  try {
    const today = await vnstatService.getTodayTraffic();
    const yesterday = await vnstatService.getYesterdayTraffic();
    
    await sendMessage(
      `📊 *Daily Traffic Report*\n\n` +
      `📅 Yesterday's Usage:\n` +
      `📥 Download: ${yesterday.rxFormatted}\n` +
      `📤 Upload: ${yesterday.txFormatted}\n` +
      `📊 Total: ${vnstatService.formatBytes(yesterday.rx + yesterday.tx)}\n\n` +
      `📅 Today so far:\n` +
      `📥 Download: ${today.rxFormatted}\n` +
      `📤 Upload: ${today.txFormatted}`
    );
  } catch (error) {
    console.error('Failed to send daily report:', error.message);
  }
};

const sendWeeklyReport = async () => {
  try {
    const week = await vnstatService.getThisWeekTraffic();
    const daily = await vnstatService.getDaily();
    
    let dailyBreakdown = daily.days.slice(-7).map(d => 
      `${d.date}: ↓${d.rxFormatted} ↑${d.txFormatted}`
    ).join('\n');
    
    await sendMessage(
      `📊 *Weekly Traffic Report*\n\n` +
      `📥 Total Download: ${week.rxFormatted}\n` +
      `📤 Total Upload: ${week.txFormatted}\n` +
      `📊 Grand Total: ${vnstatService.formatBytes(week.rx + week.tx)}\n\n` +
      `📅 Daily Breakdown:\n${dailyBreakdown}`
    );
  } catch (error) {
    console.error('Failed to send weekly report:', error.message);
  }
};

const sendMonthlyReport = async () => {
  try {
    const month = await vnstatService.getThisMonthTraffic();
    const monthly = await vnstatService.getMonthly();
    
    let monthlyBreakdown = monthly.months.slice(-3).map(m => 
      `${m.date}: ↓${m.rxFormatted} ↑${m.txFormatted}`
    ).join('\n');
    
    await sendMessage(
      `📊 *Monthly Traffic Report*\n\n` +
      `📥 This Month Download: ${month.rxFormatted}\n` +
      `📤 This Month Upload: ${month.txFormatted}\n` +
      `📊 Grand Total: ${vnstatService.formatBytes(month.rx + month.tx)}\n\n` +
      `📅 Last 3 Months:\n${monthlyBreakdown}`
    );
  } catch (error) {
    console.error('Failed to send monthly report:', error.message);
  }
};

const checkThresholds = async () => {
  try {
    const today = new Date().toDateString();
    
    // Check daily threshold
    const dailyTraffic = await vnstatService.getTodayTraffic();
    const dailyTotal = dailyTraffic.rx + dailyTraffic.tx;
    
    if (dailyTotal > DAILY_THRESHOLD && lastAlertSent.daily !== today) {
      await sendMessage(
        `⚠️ *Daily Traffic Alert!*\n\n` +
        `Today's usage has exceeded ${vnstatService.formatBytes(DAILY_THRESHOLD)}!\n\n` +
        `Current: ${vnstatService.formatBytes(dailyTotal)}\n` +
        `📥 Download: ${dailyTraffic.rxFormatted}\n` +
        `📤 Upload: ${dailyTraffic.txFormatted}`
      );
      lastAlertSent.daily = today;
    }
    
    // Check weekly threshold
    const weeklyTraffic = await vnstatService.getThisWeekTraffic();
    const weeklyTotal = weeklyTraffic.rx + weeklyTraffic.tx;
    const weekKey = `${new Date().getFullYear()}-W${Math.ceil((new Date().getDate()) / 7)}`;
    
    if (weeklyTotal > WEEKLY_THRESHOLD && lastAlertSent.weekly !== weekKey) {
      await sendMessage(
        `⚠️ *Weekly Traffic Alert!*\n\n` +
        `This week's usage has exceeded ${vnstatService.formatBytes(WEEKLY_THRESHOLD)}!\n\n` +
        `Current: ${vnstatService.formatBytes(weeklyTotal)}\n` +
        `📥 Download: ${weeklyTraffic.rxFormatted}\n` +
        `📤 Upload: ${weeklyTraffic.txFormatted}`
      );
      lastAlertSent.weekly = weekKey;
    }
    
    // Check monthly threshold
    const monthlyTraffic = await vnstatService.getThisMonthTraffic();
    const monthlyTotal = monthlyTraffic.rx + monthlyTraffic.tx;
    const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    
    if (monthlyTotal > MONTHLY_THRESHOLD && lastAlertSent.monthly !== monthKey) {
      await sendMessage(
        `⚠️ *Monthly Traffic Alert!*\n\n` +
        `This month's usage has exceeded ${vnstatService.formatBytes(MONTHLY_THRESHOLD)}!\n\n` +
        `Current: ${vnstatService.formatBytes(monthlyTotal)}\n` +
        `📥 Download: ${monthlyTraffic.rxFormatted}\n` +
        `📤 Upload: ${monthlyTraffic.txFormatted}`
      );
      lastAlertSent.monthly = monthKey;
    }
  } catch (error) {
    console.error('Failed to check thresholds:', error.message);
  }
};

module.exports = {
  init,
  sendMessage,
  sendDailyReport,
  sendWeeklyReport,
  sendMonthlyReport,
  checkThresholds
};

