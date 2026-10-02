/**
 * Detects service type and intent from user message
 */

const SERVICE_KEYWORDS = {
  PLUMBER: [
    'pipe', 'leak', 'water', 'drain', 'faucet', 'tap', 'toilet', 'flush',
    'plumb', 'sink', 'sewage', 'bathroom', 'blockage', 'clog', 'overflow',
    'valve', 'pump', 'geyser', 'hot water', 'shower', 'bath'
  ],
  ELECTRICIAN: [
    'electric', 'power', 'wire', 'light', 'switch', 'socket', 'outlet',
    'circuit', 'breaker', 'fuse', 'short circuit', 'fan', 'bulb', 'lamp',
    'voltage', 'current', 'tripped', 'blackout', 'sparks', 'wiring',
    'meter', 'mcb', 'plug', 'extension', 'inverter', 'generator'
  ],
  AC_TECHNICIAN: [
    'ac', 'air condition', 'aircondition', 'air-condition', 'cooling',
    'cool', 'refrigerat', 'compressor', 'gas', 'filter', 'remote',
    'temperature', 'hvac', 'duct', 'split', 'window unit', 'thermostat',
    'freeze', 'cold', 'heat pump', 'ventilat'
  ],
  CARPENTER: [
    'wood', 'furniture', 'door', 'window frame', 'cabinet', 'cupboard',
    'shelf', 'shelv', 'wardrobe', 'table', 'chair', 'bed frame', 'hinge',
    'lock', 'repair wood', 'polish', 'laminate', 'carpentr', 'join',
    'panel', 'ceiling board', 'flooring', 'partition'
  ],
};

const URGENCY_KEYWORDS = {
  HIGH: ['urgent', 'emergency', 'immediately', 'asap', 'critical', 'flooding', 'fire', 'danger', 'burst', 'no water', 'no power', 'sparks'],
  LOW: ['sometime', 'whenever', 'not urgent', 'can wait', 'flexible', 'schedule'],
};

const CANCEL_KEYWORDS = ['cancel', 'stop', 'nevermind', 'never mind', 'forget it', 'no thanks', 'exit', 'quit'];

const CONFIRM_KEYWORDS = ['yes', 'ok', 'okay', 'sure', 'confirm', 'approve', 'agree', 'proceed', 'go ahead', 'pay', 'accept'];

const REJECT_KEYWORDS = ['no', 'reject', 'decline', 'too expensive', 'not ok', 'not okay', 'do not approve', "don't approve", 'disagree', 'refuse'];

function containsPhrase(text, phrase) {
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizedPhrase = phrase.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}

/**
 * Detect which service type is mentioned in text
 */
export function detectServiceType(text) {
  const lower = text.toLowerCase();
  let bestMatch = null;
  let bestCount = 0;

  for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    const count = keywords.filter(kw => lower.includes(kw)).length;
    if (count > bestCount) {
      bestCount = count;
      bestMatch = service;
    }
  }

  return bestCount > 0 ? bestMatch : null;
}

/**
 * Detect urgency level
 */
export function detectUrgency(text) {
  const lower = text.toLowerCase();
  for (const kw of URGENCY_KEYWORDS.HIGH) {
    if (lower.includes(kw)) return 'HIGH';
  }
  for (const kw of URGENCY_KEYWORDS.LOW) {
    if (lower.includes(kw)) return 'LOW';
  }
  return 'NORMAL';
}

/**
 * Detect cancellation intent
 */
export function detectCancelIntent(text) {
  const lower = text.toLowerCase();
  return CANCEL_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Detect confirmation intent
 */
export function detectConfirmIntent(text) {
  return CONFIRM_KEYWORDS.some(keyword => containsPhrase(text, keyword));
}

/**
 * Detect rejection intent
 */
export function detectRejectIntent(text) {
  return REJECT_KEYWORDS.some(keyword => containsPhrase(text, keyword));
}

/**
 * Full intent analysis
 */
export function analyzeIntent(text) {
  const wantsReject = detectRejectIntent(text);
  return {
    serviceType: detectServiceType(text),
    urgency: detectUrgency(text),
    wantsCancel: detectCancelIntent(text),
    wantsConfirm: !wantsReject && detectConfirmIntent(text),
    wantsReject,
  };
}
