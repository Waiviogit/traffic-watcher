const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const INTERFACE = process.env.NETWORK_INTERFACE || 'eth0';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const parseVnstatJson = async (args) => {
  try {
    const { stdout } = await execPromise(`vnstat ${args} --json`);
    return JSON.parse(stdout);
  } catch (error) {
    console.error('vnstat error:', error.message);
    throw new Error('Failed to get vnstat data');
  }
};

const getSummary = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE}`);
  const iface = data.interfaces[0];
  
  return {
    interface: iface.name,
    created: iface.created,
    updated: iface.updated,
    traffic: {
      total: {
        rx: iface.traffic.total.rx,
        tx: iface.traffic.total.tx,
        rxFormatted: formatBytes(iface.traffic.total.rx),
        txFormatted: formatBytes(iface.traffic.total.tx)
      }
    }
  };
};

const getHourly = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE} -h 24`);
  const iface = data.interfaces[0];
  
  return {
    interface: iface.name,
    hours: iface.traffic.hour.map(h => ({
      date: `${h.date.year}-${String(h.date.month).padStart(2, '0')}-${String(h.date.day).padStart(2, '0')}`,
      hour: h.time.hour,
      rx: h.rx,
      tx: h.tx,
      rxFormatted: formatBytes(h.rx),
      txFormatted: formatBytes(h.tx)
    }))
  };
};

const getDaily = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE} -d 30`);
  const iface = data.interfaces[0];
  
  return {
    interface: iface.name,
    days: iface.traffic.day.map(d => ({
      date: `${d.date.year}-${String(d.date.month).padStart(2, '0')}-${String(d.date.day).padStart(2, '0')}`,
      rx: d.rx,
      tx: d.tx,
      rxFormatted: formatBytes(d.rx),
      txFormatted: formatBytes(d.tx)
    }))
  };
};

const getWeekly = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE} -w`);
  const iface = data.interfaces[0];
  
  // Group daily data into weeks
  const dailyData = await parseVnstatJson(`-i ${INTERFACE} -d 90`);
  const days = dailyData.interfaces[0].traffic.day;
  
  const weeks = [];
  let currentWeek = { rx: 0, tx: 0, startDate: null, endDate: null };
  
  days.forEach((d, index) => {
    const date = new Date(d.date.year, d.date.month - 1, d.date.day);
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 1 && currentWeek.startDate) {
      weeks.push({
        ...currentWeek,
        rxFormatted: formatBytes(currentWeek.rx),
        txFormatted: formatBytes(currentWeek.tx)
      });
      currentWeek = { rx: 0, tx: 0, startDate: null, endDate: null };
    }
    
    if (!currentWeek.startDate) {
      currentWeek.startDate = `${d.date.year}-${String(d.date.month).padStart(2, '0')}-${String(d.date.day).padStart(2, '0')}`;
    }
    
    currentWeek.rx += d.rx;
    currentWeek.tx += d.tx;
    currentWeek.endDate = `${d.date.year}-${String(d.date.month).padStart(2, '0')}-${String(d.date.day).padStart(2, '0')}`;
  });
  
  if (currentWeek.startDate) {
    weeks.push({
      ...currentWeek,
      rxFormatted: formatBytes(currentWeek.rx),
      txFormatted: formatBytes(currentWeek.tx)
    });
  }
  
  return {
    interface: iface.name,
    weeks: weeks.slice(-12)
  };
};

const getMonthly = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE} -m 12`);
  const iface = data.interfaces[0];
  
  return {
    interface: iface.name,
    months: iface.traffic.month.map(m => ({
      date: `${m.date.year}-${String(m.date.month).padStart(2, '0')}`,
      year: m.date.year,
      month: m.date.month,
      rx: m.rx,
      tx: m.tx,
      rxFormatted: formatBytes(m.rx),
      txFormatted: formatBytes(m.tx)
    }))
  };
};

const getLive = async () => {
  try {
    const { stdout } = await execPromise(`vnstat -i ${INTERFACE} -tr 2`);
    const lines = stdout.split('\n');
    
    let rx = '0', tx = '0';
    lines.forEach(line => {
      if (line.includes('rx')) {
        const match = line.match(/(\d+\.?\d*)\s*(bit|Kbit|Mbit|Gbit)\/s/i);
        if (match) rx = `${match[1]} ${match[2]}/s`;
      }
      if (line.includes('tx')) {
        const match = line.match(/(\d+\.?\d*)\s*(bit|Kbit|Mbit|Gbit)\/s/i);
        if (match) tx = `${match[1]} ${match[2]}/s`;
      }
    });
    
    return { rx, tx, timestamp: new Date().toISOString() };
  } catch (error) {
    return { rx: '0 bit/s', tx: '0 bit/s', timestamp: new Date().toISOString() };
  }
};

const getInterfaces = async () => {
  try {
    const { stdout } = await execPromise('vnstat --iflist');
    const match = stdout.match(/Available interfaces: (.+)/);
    if (match) {
      return match[1].split(' ').filter(i => i.trim());
    }
    return [];
  } catch (error) {
    return [];
  }
};

const getTodayTraffic = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE} -d 1`);
  const today = data.interfaces[0].traffic.day[0];
  return {
    rx: today?.rx || 0,
    tx: today?.tx || 0,
    rxFormatted: formatBytes(today?.rx || 0),
    txFormatted: formatBytes(today?.tx || 0)
  };
};

const getYesterdayTraffic = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE} -d 2`);
  const days = data.interfaces[0].traffic.day;
  const yesterday = days.length > 1 ? days[0] : null;
  return {
    rx: yesterday?.rx || 0,
    tx: yesterday?.tx || 0,
    rxFormatted: formatBytes(yesterday?.rx || 0),
    txFormatted: formatBytes(yesterday?.tx || 0)
  };
};

const getThisWeekTraffic = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE} -d 7`);
  const days = data.interfaces[0].traffic.day;
  
  let rx = 0, tx = 0;
  days.forEach(d => {
    rx += d.rx;
    tx += d.tx;
  });
  
  return {
    rx,
    tx,
    rxFormatted: formatBytes(rx),
    txFormatted: formatBytes(tx)
  };
};

const getThisMonthTraffic = async () => {
  const data = await parseVnstatJson(`-i ${INTERFACE} -m 1`);
  const month = data.interfaces[0].traffic.month[0];
  return {
    rx: month?.rx || 0,
    tx: month?.tx || 0,
    rxFormatted: formatBytes(month?.rx || 0),
    txFormatted: formatBytes(month?.tx || 0)
  };
};

module.exports = {
  getSummary,
  getHourly,
  getDaily,
  getWeekly,
  getMonthly,
  getLive,
  getInterfaces,
  getTodayTraffic,
  getYesterdayTraffic,
  getThisWeekTraffic,
  getThisMonthTraffic,
  formatBytes
};

