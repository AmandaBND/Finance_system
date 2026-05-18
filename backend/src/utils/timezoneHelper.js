const { format, utcToZonedTime } = require('date-fns');

const SRI_LANKA_TZ = 'Asia/Colombo';

/**
 * Get current time in Sri Lanka timezone (UTC+5:30)
 * Returns ISO string in Sri Lanka local time
 */
function getSriLankaTime() {
  const now = new Date();
  // Sri Lanka is UTC+5:30
  const offset = 5.5 * 60 * 60 * 1000;
  const sriLankaTime = new Date(now.getTime() + offset);
  return sriLankaTime.toISOString().split('Z')[0]; // Remove Z to indicate local time
}

/**
 * Format a date to Sri Lanka timezone display string
 * @param {Date|string} date - Date to format
 * @param {string} formatStr - format string (default: 'yyyy-MM-dd HH:mm:ss')
 */
function formatSriLankaTime(date, formatStr = 'yyyy-MM-dd HH:mm:ss') {
  const d = typeof date === 'string' ? new Date(date) : date;
  const offset = 5.5 * 60 * 60 * 1000;
  const sriLankaDate = new Date(d.getTime() + offset);
  return format(sriLankaDate, formatStr);
}

module.exports = { getSriLankaTime, formatSriLankaTime, SRI_LANKA_TZ };
