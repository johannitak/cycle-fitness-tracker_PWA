/**
 * Cycle Sync Module - Manages cycle data from Apple Health or local REST endpoint
 *
 * Expected Apple Health JSON format (from Health Auto Export):
 * {
 *   "data": {
 *     "menstrualFlow": [
 *       { "date": "2025-03-01 00:00:00 +0000", "value": "unspecified" },
 *       { "date": "2025-04-01 00:00:00 +0000", "value": "unspecified" }
 *     ]
 *   }
 * }
 *
 * For local REST endpoint, configure a server that returns the same JSON format.
 * Example: http://localhost:3456/cycle
 */

// Global cycle state object (exposed to window)
window.cycleState = {
  day: null,
  phase: null,
  phaseName: null,
  source: null, // 'manual', 'appleHealth', 'restEndpoint'
  importedAt: null,
  lastPeriodDate: null,
  avgCycleLength: 29
};

// Cycle phase definitions
const CYCLE_PHASES = {
  menstrual: { days: [1, 5], name: 'Menstrual', color: '#fee' },
  follicular: { days: [6, 13], name: 'Follicular', color: '#efe' },
  ovulatory: { days: [14, 17], name: 'Ovulatory', color: '#ffe' },
  luteal: { days: [18, 28], name: 'Luteal', color: '#eef' }
};

/**
 * Parse Apple Health JSON export and find the most recent menstrual period
 * @param {Object} jsonData - Parsed JSON from Apple Health JSON export
 * @returns {String|null} - ISO date string of most recent period start, or null
 */
function extractLatestPeriodFromAppleHealth(jsonData) {
  if (!jsonData || !jsonData.data || !jsonData.data.menstrualFlow) {
    return null;
  }

  const menstrualFlows = jsonData.data.menstrualFlow;
  if (!Array.isArray(menstrualFlows) || menstrualFlows.length === 0) {
    return null;
  }

  // Sort by date descending and get the most recent
  const sortedFlows = menstrualFlows
    .map(entry => ({
      date: new Date(entry.date),
      original: entry.date
    }))
    .sort((a, b) => b.date - a.date);

  if (sortedFlows.length === 0) {
    return null;
  }

  const latestDate = sortedFlows[0].date;
  return latestDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

/**
 * Calculate cycle day from period start date and avg cycle length
 * @param {String} periodStartDate - ISO date (YYYY-MM-DD)
 * @param {Number} avgCycleLength - Average cycle length in days
 * @returns {Object} - { day, phase, phaseName }
 */
function calculateCycleDay(periodStartDate, avgCycleLength = 29) {
  if (!periodStartDate) {
    return { day: null, phase: null, phaseName: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const periodDate = new Date(periodStartDate);
  periodDate.setHours(0, 0, 0, 0);

  const diffMs = today - periodDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const cycleDay = diffDays + 1;

  // Normalize cycle day to cycle length
  const normalizedDay = ((cycleDay - 1) % avgCycleLength) + 1;

  // Calculate phase
  let phase = null;
  let phaseName = null;

  for (const [key, phaseInfo] of Object.entries(CYCLE_PHASES)) {
    const [startDay, endDay] = phaseInfo.days;
    const cycleLen = avgCycleLength;

    // Adjust luteal end day to cycle length
    let adjustedEndDay = endDay;
    if (key === 'luteal') {
      adjustedEndDay = cycleLen;
    }

    if (normalizedDay >= startDay && normalizedDay <= adjustedEndDay) {
      phase = key;
      phaseName = phaseInfo.name;
      break;
    }
  }

  return { day: cycleDay, phase, phaseName };
}

/**
 * Handle Apple Health JSON file import
 * @param {File} file - JSON file from user
 * @param {Function} callback - Callback(success, message)
 */
function importAppleHealthJSON(file, callback) {
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const jsonData = JSON.parse(e.target.result);
      const periodDate = extractLatestPeriodFromAppleHealth(jsonData);

      if (!periodDate) {
        callback(false, '❌ No menstrual flow data found in the JSON file.');
        return;
      }

      // Calculate cycle day
      const cycleLen = window.cycleState.avgCycleLength || 29;
      const cycleInfo = calculateCycleDay(periodDate, cycleLen);

      // Update global cycle state
      window.cycleState = {
        day: cycleInfo.day,
        phase: cycleInfo.phase,
        phaseName: cycleInfo.phaseName,
        source: 'appleHealth',
        importedAt: new Date().toISOString(),
        lastPeriodDate: periodDate,
        avgCycleLength: cycleLen
      };

      // Save to localStorage
      localStorage.setItem('cycleState', JSON.stringify(window.cycleState));
      localStorage.setItem('lastPeriodDate', periodDate);

      callback(true, `✅ Apple Health data imported! Day ${cycleInfo.day} of ${cycleLen} (${cycleInfo.phaseName} phase). Last period: ${periodDate}`);
    } catch (error) {
      console.error('Error parsing Apple Health JSON:', error);
      callback(false, `❌ Failed to parse JSON file: ${error.message}`);
    }
  };

  reader.onerror = function() {
    callback(false, '❌ Failed to read the file.');
  };

  reader.readAsText(file);
}

/**
 * Fetch cycle data from local REST endpoint
 * @param {String} url - Endpoint URL (e.g., http://localhost:3456/cycle)
 * @param {Function} callback - Callback(success, message)
 */
async function fetchCycleFromRestEndpoint(url, callback) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const jsonData = await response.json();
    const periodDate = extractLatestPeriodFromAppleHealth(jsonData);

    if (!periodDate) {
      callback(false, '⚠️ No menstrual flow data at endpoint.');
      return;
    }

    // Calculate cycle day
    const cycleLen = window.cycleState.avgCycleLength || 29;
    const cycleInfo = calculateCycleDay(periodDate, cycleLen);

    // Update global cycle state
    window.cycleState = {
      day: cycleInfo.day,
      phase: cycleInfo.phase,
      phaseName: cycleInfo.phaseName,
      source: 'restEndpoint',
      importedAt: new Date().toISOString(),
      lastPeriodDate: periodDate,
      avgCycleLength: cycleLen
    };

    localStorage.setItem('cycleState', JSON.stringify(window.cycleState));
    localStorage.setItem('lastPeriodDate', periodDate);

    callback(true, `✅ Synced from REST endpoint. Day ${cycleInfo.day} (${cycleInfo.phaseName} phase).`);
  } catch (error) {
    console.warn('REST endpoint unreachable, using cached cycle data:', error);
    callback(false, `⚠️ Endpoint unreachable: ${error.message}. Using cached data.`);
  }
}

/**
 * Initialize cycle state from localStorage or manual settings
 */
function initializeCycleState() {
  // Try to load from localStorage first
  const savedState = localStorage.getItem('cycleState');
  if (savedState) {
    try {
      window.cycleState = JSON.parse(savedState);
      return;
    } catch (e) {
      console.warn('Could not parse saved cycle state:', e);
    }
  }

  // Fall back to manual settings (last period date)
  const lastPeriodDate = localStorage.getItem('lastPeriodDate');
  const avgCycleLength = parseInt(localStorage.getItem('avgCycleLength')) || 29;

  if (lastPeriodDate) {
    const cycleInfo = calculateCycleDay(lastPeriodDate, avgCycleLength);
    window.cycleState = {
      day: cycleInfo.day,
      phase: cycleInfo.phase,
      phaseName: cycleInfo.phaseName,
      source: 'manual',
      importedAt: null,
      lastPeriodDate: lastPeriodDate,
      avgCycleLength: avgCycleLength
    };
  }
}

/**
 * Format the last import time for UI display
 * @returns {String}
 */
function getLastImportDisplay() {
  if (!window.cycleState.importedAt) {
    if (window.cycleState.source === 'manual') {
      return 'Manual (last updated: check settings)';
    }
    return 'No import yet';
  }

  const importDate = new Date(window.cycleState.importedAt);
  const now = new Date();
  const diffMs = now - importDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}

/**
 * Start polling REST endpoint at specified interval
 * @param {String} url - Endpoint URL
 * @param {Number} intervalMs - Poll interval in milliseconds (default 30 min)
 * @returns {Number} - Interval ID for cleanup
 */
function startRestEndpointPolling(url, intervalMs = 30 * 60 * 1000) {
  // Do initial fetch
  fetchCycleFromRestEndpoint(url, (success, msg) => {
    console.log('REST endpoint poll:', msg);
  });

  // Poll at interval
  return setInterval(() => {
    fetchCycleFromRestEndpoint(url, (success, msg) => {
      console.log('REST endpoint poll:', msg);
    });
  }, intervalMs);
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCycleState);
} else {
  initializeCycleState();
}
