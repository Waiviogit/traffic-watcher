# 📊 Traffic Watcher

A modern network traffic monitoring system with vnStat, React dashboard, and Telegram notifications.

![Traffic Watcher Dashboard](https://via.placeholder.com/800x400/0a0e14/00f5d4?text=Traffic+Watcher+Dashboard)

## Features

- 📈 **Real-time Monitoring**: Live bandwidth display
- 📊 **Historical Data**: Hourly, daily, weekly, and monthly statistics
- 📱 **Telegram Bot**: Get traffic reports and alerts on your phone
- ⚠️ **Smart Alerts**: Configurable threshold notifications
- 🎨 **Modern UI**: Beautiful dark theme dashboard with charts
- 🐳 **Docker Ready**: Easy deployment with Docker Compose

## Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/your-repo/traffic-watcher.git
cd traffic-watcher

# Copy environment file
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Configure Telegram (Optional)

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Get your bot token and add it to `.env`
3. Start your bot and send `/start` to get your Chat ID
4. Add Chat ID to `.env`

### 3. Find Your Network Interface

```bash
# Linux
ip link show
# or
ifconfig

# Look for interfaces like: eth0, ens3, enp0s3, etc.
```

### 4. Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f traffic-watcher
```

### 5. Access Dashboard

Open http://localhost:3001 in your browser.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NETWORK_INTERFACE` | `eth0` | Network interface to monitor |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot token from BotFather |
| `TELEGRAM_CHAT_ID` | - | Your Telegram chat ID |
| `DAILY_THRESHOLD_GB` | `100` | Daily traffic alert threshold (GB) |
| `WEEKLY_THRESHOLD_GB` | `500` | Weekly traffic alert threshold (GB) |
| `MONTHLY_THRESHOLD_GB` | `2000` | Monthly traffic alert threshold (GB) |
| `DAILY_REPORT_CRON` | `0 9 * * *` | Daily report schedule |
| `WEEKLY_REPORT_CRON` | `0 9 * * 1` | Weekly report schedule (Mondays) |
| `MONTHLY_REPORT_CRON` | `0 9 1 * *` | Monthly report schedule (1st of month) |
| `PORT` | `3001` | Backend server port |

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message and Chat ID |
| `/status` | Overall traffic summary |
| `/today` | Today's traffic stats |
| `/week` | This week's traffic stats |
| `/month` | This month's traffic stats |
| `/live` | Current bandwidth usage |
| `/thresholds` | View alert thresholds |
| `/help` | Show all commands |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/traffic/summary` | Overall traffic summary |
| `GET /api/traffic/hourly` | Last 24 hours data |
| `GET /api/traffic/daily` | Last 30 days data |
| `GET /api/traffic/weekly` | Weekly aggregated data |
| `GET /api/traffic/monthly` | Monthly data |
| `GET /api/traffic/live` | Current bandwidth (2s sample) |
| `GET /api/interfaces` | Available network interfaces |
| `GET /api/health` | Health check |

## Development

### Prerequisites

- Node.js 18+
- vnstat 2.x installed on host
- npm or yarn

### Local Development

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000 with API proxy to backend.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   React App     │────▶│  Node.js API │────▶│   vnStat    │
│   (Dashboard)   │     │   (Express)  │     │  (Monitor)  │
└─────────────────┘     └──────┬───────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Telegram    │
                        │  Bot API     │
                        └──────────────┘
```

## Troubleshooting

### vnstat not collecting data

```bash
# Check vnstat daemon
docker exec traffic-watcher vnstatd -?

# Force interface add
docker exec traffic-watcher vnstat -i eth0 --add

# Check interfaces
docker exec traffic-watcher vnstat --iflist
```

### Permission denied

The container needs `NET_ADMIN` capability and host network mode to monitor traffic properly.

### No data showing

vnstat needs time to collect data. Wait a few minutes after first start.

## License

MIT License - feel free to use and modify.

