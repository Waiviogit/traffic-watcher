import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Use Vite's base URL for API calls (handles /traffic prefix in production)
const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#131920',
        border: '1px solid #1e2732',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <p style={{ color: '#8b949e', marginBottom: '8px', fontWeight: 500 }}>{label}</p>
        <p style={{ color: '#00f5d4', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>
          ↓ Download: {formatBytes(payload[0]?.value)}
        </p>
        <p style={{ color: '#f72585', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem' }}>
          ↑ Upload: {formatBytes(payload[1]?.value)}
        </p>
      </div>
    );
  }
  return null;
};

function App() {
  const [activeTab, setActiveTab] = useState('daily');
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, dailyRes, weeklyRes, monthlyRes, hourlyRes] = await Promise.all([
        fetch(`${API_BASE}/traffic/summary`),
        fetch(`${API_BASE}/traffic/daily`),
        fetch(`${API_BASE}/traffic/weekly`),
        fetch(`${API_BASE}/traffic/monthly`),
        fetch(`${API_BASE}/traffic/hourly`)
      ]);

      if (!summaryRes.ok) throw new Error('Failed to fetch data');

      const [summaryData, daily, weekly, monthly, hourly] = await Promise.all([
        summaryRes.json(),
        dailyRes.json(),
        weeklyRes.json(),
        monthlyRes.json(),
        hourlyRes.json()
      ]);

      setSummary(summaryData);
      setDailyData(daily.days || []);
      setWeeklyData(weekly.weeks || []);
      setMonthlyData(monthly.months || []);
      setHourlyData(hourly.hours || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/traffic/live`);
      const data = await res.json();
      setLiveData(data);
    } catch (err) {
      console.error('Failed to fetch live data');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 10000); // Refresh live every 10 seconds
    return () => clearInterval(interval);
  }, [fetchLive]);

  const getChartData = () => {
    switch (activeTab) {
      case 'hourly':
        return hourlyData.map(h => ({
          name: `${String(h.hour).padStart(2, '0')}:00`,
          rx: h.rx,
          tx: h.tx
        }));
      case 'daily':
        return dailyData.slice(-14).map(d => ({
          name: d.date.split('-').slice(1).join('/'),
          rx: d.rx,
          tx: d.tx
        }));
      case 'weekly':
        return weeklyData.map((w, i) => ({
          name: `Week ${i + 1}`,
          rx: w.rx,
          tx: w.tx
        }));
      case 'monthly':
        return monthlyData.map(m => ({
          name: m.date,
          rx: m.rx,
          tx: m.tx
        }));
      default:
        return [];
    }
  };

  const getTableData = () => {
    switch (activeTab) {
      case 'hourly':
        return hourlyData.slice().reverse();
      case 'daily':
        return dailyData.slice().reverse();
      case 'weekly':
        return weeklyData.slice().reverse();
      case 'monthly':
        return monthlyData.slice().reverse();
      default:
        return [];
    }
  };

  const getTodayTotal = () => {
    if (!dailyData.length) return { rx: 0, tx: 0 };
    const today = dailyData[dailyData.length - 1];
    return { rx: today?.rx || 0, tx: today?.tx || 0 };
  };

  const getThisWeekTotal = () => {
    const last7Days = dailyData.slice(-7);
    return last7Days.reduce((acc, d) => ({
      rx: acc.rx + (d.rx || 0),
      tx: acc.tx + (d.tx || 0)
    }), { rx: 0, tx: 0 });
  };

  const getThisMonthTotal = () => {
    if (!monthlyData.length) return { rx: 0, tx: 0 };
    const thisMonth = monthlyData[monthlyData.length - 1];
    return { rx: thisMonth?.rx || 0, tx: thisMonth?.tx || 0 };
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading traffic data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <h3>⚠️ Connection Error</h3>
          <p>{error}</p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
            Make sure vnstat is running and the backend is connected.
          </p>
        </div>
      </div>
    );
  }

  const todayTotal = getTodayTotal();
  const weekTotal = getThisWeekTotal();
  const monthTotal = getThisMonthTotal();
  const chartData = getChartData();
  const tableData = getTableData();

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">📊</div>
          <h1>Traffic Watcher</h1>
        </div>
        <div className="header-right">
          {liveData && (
            <div className="live-indicator">
              <div className="live-dot"></div>
              <span>↓ {liveData.rx} | ↑ {liveData.tx}</span>
            </div>
          )}
          <div className="interface-badge">
            {summary?.interface || 'eth0'}
          </div>
        </div>
      </header>

      <div className="summary-grid">
        <div className="summary-card download">
          <div className="label">
            <span className="icon">📥</span>
            Today Download
          </div>
          <div className="value">{formatBytes(todayTotal.rx)}</div>
          <div className="subtext">↑ {formatBytes(todayTotal.tx)} upload</div>
        </div>
        
        <div className="summary-card upload">
          <div className="label">
            <span className="icon">📆</span>
            This Week
          </div>
          <div className="value">{formatBytes(weekTotal.rx + weekTotal.tx)}</div>
          <div className="subtext">↓ {formatBytes(weekTotal.rx)} | ↑ {formatBytes(weekTotal.tx)}</div>
        </div>

        <div className="summary-card download">
          <div className="label">
            <span className="icon">📅</span>
            This Month
          </div>
          <div className="value">{formatBytes(monthTotal.rx + monthTotal.tx)}</div>
          <div className="subtext">↓ {formatBytes(monthTotal.rx)} | ↑ {formatBytes(monthTotal.tx)}</div>
        </div>

        <div className="summary-card">
          <div className="label">
            <span className="icon">📊</span>
            All Time
          </div>
          <div className="value">{summary?.traffic?.total?.rxFormatted || '0 B'}</div>
          <div className="subtext">↑ {summary?.traffic?.total?.txFormatted || '0 B'}</div>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'hourly' ? 'active' : ''}`}
          onClick={() => setActiveTab('hourly')}
        >
          Hourly
        </button>
        <button 
          className={`tab ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          Daily
        </button>
        <button 
          className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveTab('weekly')}
        >
          Weekly
        </button>
        <button 
          className={`tab ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          Monthly
        </button>
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <h2 className="chart-title">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Traffic
          </h2>
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-dot download"></div>
              <span>Download</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot upload"></div>
              <span>Upload</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          {activeTab === 'hourly' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f5d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00f5d4" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f72585" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f72585" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2732" />
              <XAxis 
                dataKey="name" 
                stroke="#484f58" 
                tick={{ fill: '#8b949e', fontSize: 12 }}
                axisLine={{ stroke: '#1e2732' }}
              />
              <YAxis 
                stroke="#484f58" 
                tick={{ fill: '#8b949e', fontSize: 12 }}
                axisLine={{ stroke: '#1e2732' }}
                tickFormatter={formatBytes}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="rx" 
                stroke="#00f5d4" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRx)" 
              />
              <Area 
                type="monotone" 
                dataKey="tx" 
                stroke="#f72585" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorTx)" 
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2732" />
              <XAxis 
                dataKey="name" 
                stroke="#484f58" 
                tick={{ fill: '#8b949e', fontSize: 12 }}
                axisLine={{ stroke: '#1e2732' }}
              />
              <YAxis 
                stroke="#484f58" 
                tick={{ fill: '#8b949e', fontSize: 12 }}
                axisLine={{ stroke: '#1e2732' }}
                tickFormatter={formatBytes}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="rx" fill="#00f5d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tx" fill="#f72585" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <h2 className="chart-title">Detailed Data</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{activeTab === 'hourly' ? 'Time' : activeTab === 'weekly' ? 'Period' : 'Date'}</th>
              <th>Download</th>
              <th>Upload</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {tableData.slice(0, 15).map((row, i) => (
              <tr key={i}>
                <td>
                  {activeTab === 'hourly' 
                    ? `${row.date} ${String(row.hour).padStart(2, '0')}:00`
                    : activeTab === 'weekly'
                    ? `${row.startDate} - ${row.endDate}`
                    : row.date
                  }
                </td>
                <td className="download-cell">{row.rxFormatted || formatBytes(row.rx)}</td>
                <td className="upload-cell">{row.txFormatted || formatBytes(row.tx)}</td>
                <td>{formatBytes((row.rx || 0) + (row.tx || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;

