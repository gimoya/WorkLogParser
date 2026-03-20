// ========== EXTENSIBLE PATTERN ARRAYS ==========
// All patterns are itemized arrays - easy to add new variations

// 1. MESSAGE HEADER PATTERNS
// Format: { pattern: RegExp, groups: { date, time, name } }
const MESSAGE_HEADER_PATTERNS = [
    // Dash format: "17.03.26, 10:13 - René Schnöller:" or "11/17/25, 19:35 - John Doe:"
    {
        pattern: /^(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}),\s*(\d{1,2}:\d{2})\s*-\s*([^:\n]+):/,
        groups: { date: 1, time: 2, name: 3 }
    },
    // Bracketed format: "[09.03.26, 18:56:29] Dimitris:"
    {
        pattern: /^\[(\d{1,2}\.\d{1,2}\.\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:\n]+):/,
        groups: { date: 1, time: 2, name: 3 }
    },
];

// 2. WORKLOG DATE PATTERNS (in message body)
// All patterns match at start of message only (with optional leading whitespace)
const WORKLOG_DATE_PATTERNS = [
    /^\s*(\d{1,2}\.\d{1,2}\.\d{4})/,            // dd.mm.yyyy (European full year)
    /^\s*(\d{1,2}\.\d{1,2}\.\d{2})/,            // dd.mm.yy (European short year)
    /^\s*(\d{1,2}\/\d{1,2}\/\d{4})/,            // mm/dd/yyyy (US full year)
    /^\s*(\d{1,2}\/\d{1,2}\/\d{2})/,            // mm/dd/yy (US short year)
    /^\s*(\d{1,2}\.\d{1,2}\.?)(?!\d)/,           // dd.mm or dd.mm. (no year - uses header year)
];

// 3. TIME PATTERNS
const TIME_PATTERNS = [
    /(\d{1,2}:\d{2})/,              // h:mm or hh:mm
];

// 4. BREAK WORD PATTERNS (fuzzy matching for typos)
// Matches: break, brake, Break, BREAK, braeke, etc.
const BREAK_WORD_PATTERNS = [
    /[Bb][Rr][Ee][Aa][Kk]/,         // break, Break, BREAK
    /[Bb][Rr][Aa][Kk][Ee]/,         // brake, Brake
    /[Bb][Rr][Aa][Ee][Kk][Ee]/,     // braeke
    /[Bb][Rr][Ee][Aa][Cc][Kk]/,     // breack
    /[Bb][Rr][Ee][Kk]/,             // brek (missing 'a')
];

// 5. BREAK DURATION PATTERNS (extensible list)
// Each returns minutes when matched
const BREAK_DURATION_PATTERNS = [
    { pattern: /(\d{1,2}):(\d{2})/, parse: (m) => parseInt(m[1]) * 60 + parseInt(m[2]) },  // hh:mm or h:mm
    { pattern: /(\d+)\s*h(?:rs?|ours?)?(?!\w)/i, parse: (m) => parseInt(m[1]) * 60 },      // 1h, 2hrs, 3hours
    { pattern: /(\d+)\s*min(?:utes?|uten)?/i, parse: (m) => parseInt(m[1]) },              // 30min, 45 minutes, minuten
    { pattern: /(\d+)\s*m\b/i, parse: (m) => parseInt(m[1]) },                             // 30 m
    { pattern: /(\d+)\s*'/, parse: (m) => parseInt(m[1]) },                                // 45'
    { pattern: /(\d+)(?=\s*$|\s*[,\n]|\s*<)/, parse: (m) => parseInt(m[1]) },              // bare number at end: 60
];

// 6. REGIE WORD PATTERNS (fuzzy matching)
// Matches: regie, Regie, REGIE, reggie, regi, etc.
const REGIE_WORD_PATTERNS = [
    /[Rr][Ee][Gg][Ii][Ee]/,         // regie, Regie
    /[Rr][Ee][Gg][Gg][Ii][Ee]/,     // reggie (double g)
    /[Rr][Ee][Gg][Ii]/,             // regi (missing e)
    /[Rr][Ee][Ii][Gg][Ii][Ee]/,     // reigie (typo)
];

// ========== HELPER FUNCTIONS ==========

// Check if any pattern matches (boolean)
function hasAnyPattern(text, patterns) {
    for (const p of patterns) {
        const pattern = p.pattern || p;
        if (pattern.test(text)) return true;
    }
    return false;
}

// Parse duration using BREAK_DURATION_PATTERNS, returns minutes
function parseDuration(text) {
    for (const p of BREAK_DURATION_PATTERNS) {
        const match = text.match(p.pattern);
        if (match) {
            return p.parse(match);
        }
    }
    return 0;
}

function formatDateToDDMMYYYY(dateStr, fallbackYear = null) {
    if (!dateStr) return '';
    
    // If already in dd.mm.yyyy format, return as is
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
        return dateStr;
    }
    
    // US format with slashes: mm/dd/yy or mm/dd/yyyy -> convert to dd.mm.yyyy
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        return `${day}.${month}.${year}`;
    }
    
    // If in d.m or d.m. or dd.m or d.mm format (single or double digits), use year from message header
    if (/^\d{1,2}\.\d{1,2}\.?$/.test(dateStr)) {
        if (!fallbackYear) {
            console.error(`ERROR: Date "${dateStr}" has no year and message header date could not be parsed`);
            return '';  // Return empty - cannot process without year
        }
        const parts = dateStr.replace(/\.$/, '').split('.');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        return `${day}.${month}.${fallbackYear}`;
    }
    
    // If in d.m.yy or dd.mm.yy format, convert to yyyy
    if (/^\d{1,2}\.\d{1,2}\.\d{2}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        return `${day}.${month}.${year}`;
    }
    
    // If in d.m.yyyy or dd.mm.yyyy format, normalize to dd.mm.yyyy
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('.');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        return `${day}.${month}.${parts[2]}`;
    }
    
    // If in yyyy-mm-dd format (from metadata), convert to dd.mm.yyyy
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const parts = dateStr.split('-');
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    
    // Try to parse as date and format
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        }
    } catch (e) {
        // If parsing fails, return original
    }
    
    return dateStr;
}

function minutesToHHMM(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function normalizeTime(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return timeStr;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToDecimalHours(minutes, decimals = 2) {
    if (minutes === null || minutes === undefined) return '';
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) return '';

    const hours = m / 60;
    const fixed = hours.toFixed(decimals);

    // Trim trailing zeros (dot-based), then comma as decimal separator (DE-style)
    const withDot = fixed
        .replace(/(\.\d*?[1-9])0+$/, '$1')
        .replace(/\.0+$/, '');
    return withDot.includes('.') ? withDot.replace('.', ',') : withDot;
}

function decimalHoursToMinutes(value) {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (raw === '') return null;

    const normalized = raw.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

    const dec = Number(normalized);
    if (!Number.isFinite(dec) || dec < 0) return null;

    return Math.round(dec * 60);
}

function calculateNettoTime(startTime, endTime, breakTime) {
    try {
        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);
        if (!startMinutes || !endMinutes) return '';

        let totalMinutes = endMinutes - startMinutes;
        if (totalMinutes < 0) {
            totalMinutes += 24 * 60; // Overnight shift
        } else if (totalMinutes === 0) {
            return '';
        }

        const breakMinutes = parseTimeToMinutes(breakTime) || 0;
        const nettoMinutes = totalMinutes - breakMinutes;
        return nettoMinutes > 0 ? minutesToHHMM(nettoMinutes) : '';
    } catch (e) {
        return '';
    }
}

// Validate time format HH:MM
function validateTimeFormat(timeStr) {
    if (!timeStr || timeStr.trim() === '') return true; // Empty is valid
    const pattern = /^\d{2}:\d{2}$/;
    if (!pattern.test(timeStr.trim())) return false;
    
    // Check valid hours (00-23) and minutes (00-59)
    const [hours, minutes] = timeStr.trim().split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// Find first date match in text using WORKLOG_DATE_PATTERNS
function findWorklogDate(text) {
    for (const pattern of WORKLOG_DATE_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            return {
                date: match[1],
                index: match.index,
                fullMatch: match[0]
            };
        }
    }
    return null;
}

// Find all times in text using TIME_PATTERNS
function findAllTimes(text) {
    const times = [];
    const pattern = /(\d{1,2}:\d{2})/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        times.push({
            time: match[1],
            index: match.index
        });
    }
    return times;
}

// Find break word in text using BREAK_WORD_PATTERNS
function findBreakWord(text) {
    for (const pattern of BREAK_WORD_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            return {
                word: match[0],
                index: match.index
            };
        }
    }
    return null;
}

// Check if regie word exists in text using REGIE_WORD_PATTERNS
function hasRegieWord(text) {
    return hasAnyPattern(text, REGIE_WORD_PATTERNS);
}

function createEmptyEntry() {
    return {
        workDate: '',
        startTime: '',
        endTime: '',
        breakTime: '',
        nettoTime: '',
        regie: ''  // Boolean as string: "Regie" or ""
    };
}

// Parse message header and create date object
// Supports both European (dd.mm.yy) and US (mm/dd/yy) formats
function parseMessageHeader(dateStr, timeStr) {
    let day, month, yearStr;
    
    if (dateStr.includes('/')) {
        // US format: mm/dd/yy
        const parts = dateStr.split('/');
        month = parts[0];
        day = parts[1];
        yearStr = parts[2];
    } else {
        // European format: dd.mm.yy
        const parts = dateStr.split('.');
        day = parts[0];
        month = parts[1];
        yearStr = parts[2];
    }
    
    const year = yearStr.length === 2 ? '20' + yearStr : yearStr;
    // Handle time with or without seconds
    const fullTime = timeStr.split(':').length === 2 ? timeStr + ':00' : timeStr;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${fullTime}`);
    return isNaN(date.getTime()) ? null : date;
}

// Process a single message and extract work info
function processMessage(message, dateStr, timeStr, sender, log) {
    const date = parseMessageHeader(dateStr, timeStr);
    if (!date) {
        log(`    ✗ Invalid header date: ${dateStr}`);
        return null;
    }
    
    log(`    Preview: "${message.substring(0, 80).replace(/\n/g, '\\n')}..."`);
    log(``);
    const workInfo = extractWorkInfo(message, dateStr, log);
    
    const hasData = workInfo.workDate || workInfo.startTime || workInfo.endTime || 
                   workInfo.breakTime || workInfo.regie;
    if (hasData) {
        log(``);
        log(`    ┌─ RESULT ─────────────────────────────────────`);
        log(`    │  Date:    ${workInfo.workDate || '-'}`);
        log(`    │  Time:    ${workInfo.startTime || '-'} - ${workInfo.endTime || '-'}`);
        log(`    │  Break:   ${workInfo.breakTime || '-'}`);
        log(`    │  Netto:   ${workInfo.nettoTime || '-'}`);
        log(`    │  Regie:   ${workInfo.regie || '-'}`);
        log(`    └──────────────────────────────────────────────`);
    } else {
        log(`    ⚠ No work data extracted`);
    }
    log(``);
    
    return createMessageEntry(dateStr, timeStr, sender, message, workInfo, date);
}

function createMessageEntry(dateStr, timeStr, sender, message, workInfo, date) {
    // Use workDate from message body, or fallback to header date if not found
    const workDate = workInfo.workDate ? formatDateToDDMMYYYY(workInfo.workDate) : '';
    
    return {
        timestamp: date.toISOString(),
        date: dateStr,
        time: timeStr,
        sender: sender.trim(),
        message: message.trim(),
        workDate: workDate,
        startTime: workInfo.startTime || '',
        endTime: workInfo.endTime || '',
        breakTime: workInfo.breakTime || '',
        nettoTime: workInfo.nettoTime || '',
        regie: workInfo.regie || ''  // "Regie" or ""
    };
}

function updateWorkInfoFromEntry(target, source) {
    if (source.workDate && !target.workDate) target.workDate = source.workDate;
    if (source.startTime && !target.startTime) target.startTime = source.startTime;
    if (source.endTime && !target.endTime) target.endTime = source.endTime;
    if (source.breakTime && !target.breakTime) target.breakTime = source.breakTime;
    if (source.nettoTime && !target.nettoTime) target.nettoTime = source.nettoTime;
    if (source.regie && !target.regie) target.regie = source.regie;
}

// Extract ZIP file
async function extractZip(input) {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded. Please check your internet connection.');
    }
    
    try {
        // Convert input to appropriate format if needed
        let zipInput = input;
        if (input instanceof ArrayBuffer) {
            // JSZip can handle ArrayBuffer directly
            zipInput = input;
        } else if (input instanceof Blob) {
            // Convert Blob to ArrayBuffer for better compatibility
            zipInput = await input.arrayBuffer();
        }
        
        // Load ZIP file
        const zip = await JSZip.loadAsync(zipInput);
        
        // Validate zip object
        if (!zip) {
            throw new Error('Failed to load ZIP file - zip object is null');
        }
        
        if (!zip.files || typeof zip.files !== 'object') {
            throw new Error('Invalid ZIP file structure - files property not found');
        }
        
        const fileContents = {};
        
        // Safely iterate through zip.files
        const fileKeys = Object.keys(zip.files);
        if (fileKeys.length === 0) {
            throw new Error('ZIP file is empty');
        }
        
        fileKeys.forEach(relativePath => {
            const file = zip.files[relativePath];
            // Check if it's a file (not a directory) and has the right extension
            if (file && !file.dir && (relativePath.endsWith('.txt') || relativePath.endsWith('.html') || relativePath.endsWith('.json'))) {
                fileContents[relativePath] = file;
            }
        });
        
        if (Object.keys(fileContents).length === 0) {
            throw new Error('No chat export files (.txt, .html, .json) found in ZIP archive');
        }
        
        // Read all file contents asynchronously
        const contents = {};
        const promises = [];
        
        for (const [filename, file] of Object.entries(fileContents)) {
            promises.push(
                file.async('text').then(text => {
                    contents[filename] = text;
                }).catch(() => {
                    // Ignore read errors for individual files
                })
            );
        }
        
        await Promise.all(promises);
        return contents;
    } catch (error) {
        throw new Error('Failed to extract ZIP file: ' + error.message);
    }
}

// Highlight matched portions in message text - simplified version
function highlightMessage(message, entry) {
    if (!entry) return message;
    
    // Check if we have any actual extracted data
    const hasData = entry.workDate?.trim() || entry.startTime?.trim() || entry.endTime?.trim() ||
        entry.breakTime?.trim() || entry.regie?.trim();
    if (!hasData) return message;
    
    const highlightRanges = [];
    
    // Helper to add match ranges
    const addMatch = (pattern, isWarning = false) => {
        const regex = new RegExp(pattern, 'gi');
        let match;
        while ((match = regex.exec(message)) !== null) {
            // Avoid overlapping with existing ranges
            const overlaps = highlightRanges.some(r => 
                (match.index >= r.start && match.index < r.end) ||
                (match.index + match[0].length > r.start && match.index + match[0].length <= r.end)
            );
            if (!overlaps) {
                highlightRanges.push({ 
                    start: match.index, 
                    end: match.index + match[0].length, 
                    text: match[0],
                    warning: isWarning
                });
            }
        }
    };
    
    // Highlight date (using WORKLOG_DATE_PATTERNS)
    for (const pattern of WORKLOG_DATE_PATTERNS) {
        addMatch(pattern.source);
    }
    
    // Highlight times
    addMatch('\\d{1,2}:\\d{2}');
    
    // Highlight break word (using BREAK_WORD_PATTERNS)
    for (const pattern of BREAK_WORD_PATTERNS) {
        addMatch(pattern.source);
    }

    // Highlight break duration (using BREAK_DURATION_PATTERNS)
    for (const p of BREAK_DURATION_PATTERNS) {
        addMatch(p.pattern.source);
    }

    // Highlight regie word if found (using REGIE_WORD_PATTERNS)
    if (entry.regie) {
        for (const pattern of REGIE_WORD_PATTERNS) {
            addMatch(pattern.source);
        }
    }
    
    // Sort by start position (descending) for applying highlights
    highlightRanges.sort((a, b) => b.start - a.start);
    
    // Apply highlights from end to start to preserve indices
    let highlighted = message;
    for (const range of highlightRanges) {
        const className = range.warning ? 'message-highlight-warning' : 'message-highlight';
        highlighted = highlighted.substring(0, range.start) +
            `<span class="${className}">` + range.text + '</span>' +
            highlighted.substring(range.end);
    }
    
    return highlighted;
}

// Extract work information from message body using pattern arrays
// Pattern: DATE, TIME, TIME, BREAK_WORD: DURATION - all must be on FIRST LINE
// Regie is checked in the full message (can be anywhere)
// headerDateStr: the date from the message header (used to fill in missing year)
function extractWorkInfo(message, headerDateStr = null, logCallback = null) {
    const entry = createEmptyEntry();
    const log = (msg) => {
        if (logCallback) logCallback(msg);
    };
    
    // Extract year from header date (required if worklog date has no year)
    let headerYear = null;
    if (headerDateStr) {
        const normalizedHeader = formatDateToDDMMYYYY(headerDateStr);
        const yearMatch = normalizedHeader.match(/\.(\d{4})$/);
        if (yearMatch) {
            headerYear = yearMatch[1];
        } else {
            log(`    ✗ ERROR: Could not extract year from header: "${headerDateStr}"`);
        }
    } else {
        log(`    ✗ ERROR: No message header date provided`);
    }
    
    // Extract first line only for structured data (date, times, break)
    const firstLine = message.split('\n')[0];
    log(`    First line: "${firstLine.substring(0, 80)}..."`);
    
    // Step 1: Find DATE using WORKLOG_DATE_PATTERNS (first line only)
    const dateMatch = findWorklogDate(firstLine);
    if (!dateMatch) {
        log(`      → No worklog date found`);
        return entry;
    }
    // Check if date has no year (needs header year)
    const isNoYearDate = /^\d{1,2}\.\d{1,2}\.?$/.test(dateMatch.date);
    const formattedDate = formatDateToDDMMYYYY(dateMatch.date, headerYear);
    if (isNoYearDate && headerYear) {
        log(`      → Date: "${dateMatch.date}" → "${formattedDate}" (year from header: ${headerYear})`);
    } else {
        log(`      → Date: "${dateMatch.date}" → "${formattedDate}"`);
    }
    entry.workDate = formattedDate;
    
    // Step 2: Find all TIMEs after the date (first line only)
    const textAfterDate = firstLine.substring(dateMatch.index + dateMatch.fullMatch.length);
    const times = findAllTimes(textAfterDate);
    
    if (times.length < 2) {
        log(`      → Times: only ${times.length} found (need 2)`);
        return entry;
    }
    
    // First two times are start and end
    entry.startTime = normalizeTime(times[0].time);
    entry.endTime = normalizeTime(times[1].time);
    log(`      → Times: ${entry.startTime} - ${entry.endTime}`);
    
    // Step 3: Find BREAK_WORD and extract duration after it (first line only)
    const breakMatch = findBreakWord(textAfterDate);
    if (breakMatch) {
        // Look for duration after the break word (with optional colon)
        const textAfterBreak = textAfterDate.substring(breakMatch.index + breakMatch.word.length);
        // Skip optional colon and whitespace
        const durationText = textAfterBreak.replace(/^[\s:]*/, '');
        
        // Parse duration using BREAK_DURATION_PATTERNS
        const breakMinutes = parseDuration(durationText);
        if (breakMinutes > 0) {
            entry.breakTime = minutesToHHMM(breakMinutes);
            log(`      → Break: "${breakMatch.word}" + ${breakMinutes} min → ${entry.breakTime}`);
        } else {
            log(`      → Break: "${breakMatch.word}" found but no valid duration`);
        }
    } else {
        log(`      → Break: none found`);
    }
    
    // Step 4: Calculate netto time
    if (entry.startTime && entry.endTime) {
        entry.nettoTime = calculateNettoTime(entry.startTime, entry.endTime, entry.breakTime);
        log(`      → Netto: ${entry.nettoTime}`);
    }
    
    // Step 5: Check for REGIE in full message (can be anywhere, not just first line)
    if (hasRegieWord(message)) {
        entry.regie = 'Regie';
        log(`      → Regie: found`);
    }
    
    return entry;
}

// Parse text format
function parseTxtChat(content, logCallback = null) {
    const messages = [];
    let statusMessagesSkipped = 0;
    let deletedMessagesSkipped = 0;
    
    const log = (msg) => {
        if (logCallback) logCallback(msg);
    };
    
    log('Starting to parse chat content...');
    
    // Find all potential message headers using MESSAGE_HEADER_PATTERNS
    // Supports both: "dd.mm.yy, hh:mm - Name:" and "[dd.mm.yy, hh:mm:ss] Name:"
    const allHeaders = [];
    
    // Try each header pattern
    for (const headerDef of MESSAGE_HEADER_PATTERNS) {
        const pattern = new RegExp(headerDef.pattern.source, 'gm');
        let headerMatch;
        while ((headerMatch = pattern.exec(content)) !== null) {
            // Avoid duplicates (same position)
            const alreadyFound = allHeaders.some(h => Math.abs(h.index - headerMatch.index) < 3);
            if (!alreadyFound) {
                allHeaders.push({
                    index: headerMatch.index,
                    dateStr: headerMatch[headerDef.groups.date],
                    timeStr: headerMatch[headerDef.groups.time],
                    fullMatch: headerMatch[0],
                    patternDef: headerDef
                });
            }
        }
    }
    
    // Sort by index to process in order
    allHeaders.sort((a, b) => a.index - b.index);
    
    log(`\n╔══════════════════════════════════════════════════════════════╗`);
    log(`║  PARSING CHAT                                                ║`);
    log(`╚══════════════════════════════════════════════════════════════╝\n`);
    log(`  Found ${allHeaders.length} potential message headers`);
    
    // Filter out status messages and deleted messages
    // Status messages have no colon after the name part
    // Deleted messages: "Diese Nachricht wurde gelöscht." or "Du hast diese Nachricht gelöscht."
    const regularMessageHeaders = [];
    const statusMessageIndices = new Set();
    const deletedMessagePattern = /^\s*‎?(du\s+hast\s+diese\s+nachricht\s+gelöscht\.|diese\s+nachricht\s+wurde\s+gelöscht\.)\s*$/i;
    
    for (let i = 0; i < allHeaders.length; i++) {
        const header = allHeaders[i];
        const nextHeaderIndex = i < allHeaders.length - 1 ? allHeaders[i + 1].index : content.length;
        const messageBlock = content.substring(header.index, Math.min(header.index + 500, nextHeaderIndex));
        
        // The header.fullMatch already matched "date, time - name:" or "[date, time] name:"
        // Check if the text after fullMatch is a deleted message
        const textAfterHeader = messageBlock.substring(header.fullMatch.length);
        const firstLineEnd = textAfterHeader.indexOf('\n');
        const firstLine = firstLineEnd > 0 ? textAfterHeader.substring(0, firstLineEnd) : textAfterHeader.substring(0, 200);
        
        // Check for deleted message
        if (deletedMessagePattern.test(firstLine.trim())) {
            deletedMessagesSkipped++;
            statusMessageIndices.add(header.index);
            continue;
        }
        
        // Check if this looks like a status message (header pattern already requires colon)
        // The pattern already filters for "Name:" at the end, so we just accept it
        regularMessageHeaders.push(header);
    }
    
    log(`  Filtered: ${regularMessageHeaders.length} valid messages`);
    log(`            (skipped: ${statusMessagesSkipped} status, ${deletedMessagesSkipped} deleted)\n`);
    log(`──────────────────────────────────────────────────────────────────\n`);
    
    for (let i = 0; i < regularMessageHeaders.length; i++) {
        const header = regularMessageHeaders[i];
        
        // Find the next header (regular or status)
        let nextHeaderIndex = content.length;
        if (i < regularMessageHeaders.length - 1) {
            nextHeaderIndex = regularMessageHeaders[i + 1].index;
        }
        
        // Also check for status message indices in between
        for (const statusIdx of statusMessageIndices) {
            if (statusIdx > header.index && statusIdx < nextHeaderIndex) {
                nextHeaderIndex = Math.min(nextHeaderIndex, statusIdx);
            }
        }
        
        // Extract the full message block
        const messageBlock = content.substring(header.index, nextHeaderIndex);
        
        // Extract sender name from the matched header
        // The header.fullMatch contains the full matched pattern including "Name:"
        // We need to extract the name part based on the pattern used
        let sender = '';
        let message = '';
        
        // Try to parse using the same pattern that matched this header
        const patternDef = header.patternDef;
        const fullHeaderMatch = messageBlock.match(patternDef.pattern);
        
        if (fullHeaderMatch && patternDef.groups.name) {
            sender = fullHeaderMatch[patternDef.groups.name].trim();
            // Message is everything after the header match
            message = messageBlock.substring(fullHeaderMatch[0].length).trim();
        } else {
            log(`  ⚠ Could not extract sender/message at index ${header.index}\n`);
            continue;
        }
        
        const dateStr = header.dateStr;
        const timeStr = header.timeStr;
        
        // Log message being processed
        log(`  ┌── MSG #${i + 1} ──────────────────────────────────────────────`);
        log(`  │  From: ${sender}`);
        log(`  │  Header: ${dateStr}, ${timeStr}`);
        log(`  └───────────────────────────────────────────────────────────`);
        
        try {
            const messageEntry = processMessage(message, dateStr, timeStr, sender, log);
            if (messageEntry) {
                messages.push(messageEntry);
            }
        } catch (e) {
            log(`    ✗ Error: ${e.message}\n`);
            continue;
        }
    }
    
    // If primary pattern didn't work, try line-by-line parsing with all header patterns
    if (messages.length === 0) {
        log('Primary pattern found no messages, trying line-by-line parsing...');
        const lines = content.split('\n');
        let currentMessage = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Try each MESSAGE_HEADER_PATTERN
            let msgMatch = null;
            let matchedPattern = null;
            
            for (const patternDef of MESSAGE_HEADER_PATTERNS) {
                const match = line.match(patternDef.pattern);
                if (match) {
                    msgMatch = match;
                    matchedPattern = patternDef;
                    break;
                }
            }
            
            if (msgMatch && matchedPattern) {
                const dateStr = msgMatch[matchedPattern.groups.date];
                const timeStr = msgMatch[matchedPattern.groups.time];
                const sender = msgMatch[matchedPattern.groups.name].trim();
                const messageStart = msgMatch[0].length;
                const message = line.substring(messageStart).trim();
                
                // Filter out deleted messages
                const deletedPattern = /^\s*‎?(du\s+hast\s+diese\s+nachricht\s+gelöscht\.|diese\s+nachricht\s+wurde\s+gelöscht\.)\s*$/i;
                if (deletedPattern.test(message)) {
                    deletedMessagesSkipped++;
                    currentMessage = null;
                    continue;
                }
                
                // Save previous message if exists
                if (currentMessage) {
                    messages.push(currentMessage);
                }
                
                try {
                    const date = parseMessageHeader(dateStr, timeStr);
                    if (date) {
                        const workInfo = extractWorkInfo(message);
                        currentMessage = createMessageEntry(dateStr, timeStr, sender, message, workInfo, date);
                    } else {
                        currentMessage = null;
                    }
                } catch (e) {
                    currentMessage = null;
                }
            } else if (currentMessage && line.trim()) {
                // Check if this line starts a new message (any header pattern)
                const startsNewMessage = MESSAGE_HEADER_PATTERNS.some(p => p.pattern.test(line));
                if (!startsNewMessage) {
                    // Continuation of previous message
                    currentMessage.message += '\n' + line.trim();
                    // Re-extract work info from full message
                    const workInfo = extractWorkInfo(currentMessage.message);
                    updateWorkInfoFromEntry(currentMessage, workInfo);
                }
            }
        }
        
        // Add last message
        if (currentMessage) {
            const workInfo = extractWorkInfo(currentMessage.message);
            updateWorkInfoFromEntry(currentMessage, workInfo);
            messages.push(currentMessage);
        }
        
        log(`  Line-by-line parsing found ${messages.length} messages\n`);
    }
    
    const nonStatusMessages = messages.length;
    
    log(`\n══════════════════════════════════════════════════════════════════`);
    log(`  SUMMARY`);
    log(`  ───────`);
    log(`  Headers found:    ${allHeaders.length}`);
    log(`  Valid messages:   ${nonStatusMessages}`);
    log(`  Skipped:          ${statusMessagesSkipped} status, ${deletedMessagesSkipped} deleted`);
    log(`══════════════════════════════════════════════════════════════════\n`);
    
    return messages;
}

// Parse HTML format
function parseHtmlChat(content) {
    const messages = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    // Try different HTML structures
    const messageDivs = doc.querySelectorAll('.message, [class*="message"]');
    
    messageDivs.forEach(div => {
        const dateEl = div.querySelector('.date, [class*="date"]');
        const senderEl = div.querySelector('.author, [class*="author"], [class*="sender"]');
        const textEl = div.querySelector('.text, [class*="text"], [class*="message"]');
        
        if (dateEl && textEl) {
            messages.push({
                timestamp: dateEl.textContent.trim(),
                sender: senderEl ? senderEl.textContent.trim() : 'Unknown',
                message: textEl.textContent.trim()
            });
        }
    });
    
    return messages;
}

// Parse JSON format
function parseJsonChat(content) {
    const messages = [];
    const data = JSON.parse(content);
    
    let messagesData = [];
    if (Array.isArray(data)) {
        messagesData = data;
    } else if (data.messages) {
        messagesData = data.messages;
    } else if (data.chat && data.chat.messages) {
        messagesData = data.chat.messages;
    }
    
    messagesData.forEach(msg => {
        if (typeof msg === 'object') {
            messages.push({
                timestamp: msg.timestamp || msg.date || '',
                sender: msg.sender || msg.from || 'Unknown',
                message: msg.message || msg.text || ''
            });
        }
    });
    
    return messages;
}

// Analyze messages
function analyzeMessages(messages) {
    if (!messages || !messages.length) {
        return {
            total_messages: 0,
            senders: {},
            date_range: null,
            messages_per_day: {}
        };
    }
    
    const stats = {
        total_messages: messages.length,
        senders: {},
        date_range: null,
        messages_per_day: {}
    };
    
    const dates = [];
    messages.forEach(msg => {
        const sender = msg.sender || 'Unknown';
        stats.senders[sender] = (stats.senders[sender] || 0) + 1;
        
        const timestamp = msg.timestamp || '';
        if (timestamp) {
            try {
                const date = timestamp.split('T')[0] || timestamp.split(' ')[0] || timestamp.substring(0, 10);
                if (date && date.length >= 8) { // Valid date format
                    dates.push(date);
                    stats.messages_per_day[date] = (stats.messages_per_day[date] || 0) + 1;
                }
            } catch (e) {
                // Ignore invalid dates
            }
        }
    });
    
    if (dates.length > 0) {
        const sortedDates = dates.sort();
        stats.date_range = {
            first: sortedDates[0],
            last: sortedDates[sortedDates.length - 1]
        };
    }
    
    return stats;
}

// Parse uploaded file
async function parseUploadedFile(file) {
    let files = {};
    
    // Try as ZIP first (even if extension is wrong)
    try {
        let arrayBuffer;
        if (file.arrayBuffer) {
            // Modern browsers
            arrayBuffer = await file.arrayBuffer();
        } else {
            // Fallback for older Android browsers using FileReader
            arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('Failed to read file'));
                reader.readAsArrayBuffer(file);
            });
        }
        files = await extractZip(arrayBuffer);
    } catch (zipError) {
        // Not a ZIP file, try as text
        try {
            let content;
            if (file.text) {
                // Modern browsers
                content = await file.text();
            } else {
                // Fallback for older Android browsers using FileReader
                content = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (e) => reject(new Error('Failed to read file'));
                    reader.readAsText(file);
                });
            }
            files[file.name] = content;
        } catch (textError) {
            throw new Error(`File "${file.name}" is not readable as ZIP or text file: ${textError.message}`);
        }
    }
    
    if (Object.keys(files).length === 0) {
        throw new Error('No files found');
    }
    
    // Helper function to setup logging
    const setupLogging = () => {
        const parseLogDiv = document.getElementById('parseLog');
        const parseLogContent = document.getElementById('parseLogContent');
        if (parseLogDiv && parseLogContent) {
            parseLogDiv.style.display = 'block';
            parseLogContent.textContent = '';
        }
        
        const logMessages = [];
        const logCallback = (msg) => {
            logMessages.push(msg);
            if (parseLogContent) {
                parseLogContent.textContent = logMessages.join('\n');
                parseLogContent.scrollTop = parseLogContent.scrollHeight;
            }
        };
        return logCallback;
    };
    
    // Parse all files
    const allMessages = [];
    for (const [filename, content] of Object.entries(files)) {
        let messages = [];
        
        if (filename.endsWith('.txt')) {
            messages = parseTxtChat(content, setupLogging());
        } else if (filename.endsWith('.html')) {
            messages = parseHtmlChat(content);
        } else if (filename.endsWith('.json')) {
            messages = parseJsonChat(content);
        } else {
            // Try to parse as text anyway
            messages = parseTxtChat(content, setupLogging());
        }
        allMessages.push(...messages);
    }
    
    // Analyze
    const stats = analyzeMessages(allMessages);
    
    return {
        success: true,
        messages: allMessages,
        statistics: stats,
        files_parsed: Object.keys(files).length
    };
}

// Generate summary tables per worker
function generateSummaryTables(messages) {
    const summaryTablesDiv = document.getElementById('summaryTables');
    if (!summaryTablesDiv) return;
    
    // Group messages by worker
    const workerData = {};
    
    messages.forEach(msg => {
        if (!msg.sender || !msg.startTime || !msg.endTime) return;
        
        const worker = msg.sender;
        if (!workerData[worker]) {
            workerData[worker] = {
                workingDays: new Set(),
                totalNettoMinutes: 0,
                regieCount: 0  // Count entries with regie
            };
        }
        
        // Count working days (unique dates) - only use dates from message body
        if (msg.workDate) {
            workerData[worker].workingDays.add(msg.workDate);
        }
        
        // Sum netto time
        if (msg.nettoTime) {
            const [hours, minutes] = msg.nettoTime.split(':').map(Number);
            workerData[worker].totalNettoMinutes += hours * 60 + minutes;
        }
        
        // Count regie entries
        if (msg.regie) {
            workerData[worker].regieCount++;
        }
    });
    
    // Generate HTML for summary tables
    let summaryHTML = '';
    
    Object.keys(workerData).sort().forEach(worker => {
        const data = workerData[worker];
        const workingDays = data.workingDays.size;
        const totalHours = Math.floor(data.totalNettoMinutes / 60);
        const totalMinutes = data.totalNettoMinutes % 60;
        const totalHoursFormatted = `${String(totalHours).padStart(2, '0')}:${String(totalMinutes).padStart(2, '0')}`;
        
        summaryHTML += `
            <div class="summary-section">
                <h3>${worker}</h3>
                <table class="summary-table" style="width: auto;">
                    <thead>
                        <tr>
                            <th style="text-align: left; white-space: nowrap;">Metric</th>
                            <th style="text-align: right; white-space: nowrap;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Working Days</strong></td>
                            <td style="text-align: right;">${workingDays}</td>
                        </tr>
                        <tr>
                            <td><strong>Working Hours (Netto)</strong></td>
                            <td style="text-align: right;">${totalHoursFormatted}</td>
                        </tr>
                        <tr>
                            <td><strong>Regie Entries</strong></td>
                            <td style="text-align: right;">${data.regieCount}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    });
    
    summaryTablesDiv.innerHTML = summaryHTML;
}

// Scroll to date in main table
function scrollToDate() {
    const gotoDateInput = document.getElementById('gotoDate');
    if (!gotoDateInput || !gotoDateInput.value) return;
    
    const targetDate = gotoDateInput.value; // YYYY-MM-DD format
    const targetDateFormatted = formatDateToDDMMYYYY(targetDate);
    
    const table = document.getElementById('messagesTable');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    let foundRow = null;
    
    // Search for first row with matching date
    for (const row of rows) {
        const dateCell = row.querySelector('[data-field="date"]');
        if (!dateCell) continue;
        
        const cellDate = (dateCell.textContent || dateCell.innerText || '').trim();
        // Compare dates - convert both to comparable format
        const cellDateComparable = parseDateToComparable(cellDate);
        if (cellDateComparable === targetDate) {
            foundRow = row;
            break;
        }
    }
    
    if (foundRow) {
        // Scroll to the row
        foundRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight the row briefly
        const originalBg = foundRow.style.backgroundColor;
        foundRow.style.backgroundColor = '#fff3cd';
        foundRow.style.transition = 'background-color 0.3s';
        setTimeout(() => {
            foundRow.style.backgroundColor = originalBg || '';
            setTimeout(() => {
                foundRow.style.transition = '';
            }, 300);
        }, 2000);
    } else {
        alert(`Date ${targetDateFormatted} not found in the table.`);
    }
}

// Sync edits from DOM back to allParsedMessages
function syncEditsToAllParsedMessages() {
    const table = document.getElementById('messagesTable');
    if (!table || allParsedMessages.length === 0) return;
    
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        // Get unique key from data attribute
        const uniqueKey = row.getAttribute('data-msg-key');
        if (!uniqueKey) return;
        
        const getCellValue = (field) => {
            const cell = row.querySelector(`[data-field="${field}"]`);
            if (!cell) return '';
            const text = (cell.textContent || cell.innerText || '').trim();
            return text.replace(/N\/A/gi, '').replace(/<[^>]*>/g, '');
        };
        
        // Find matching message in allParsedMessages using the unique key
        const originalMsg = allParsedMessages.find(msg => {
            const msgKey = `${msg.date}_${msg.time}_${msg.sender}_${msg.message}`;
            return msgKey === uniqueKey;
        });
        
        if (originalMsg) {
            // Update the original message with edited values
            const workDate = getCellValue('date');
            const startTime = getCellValue('startTime');
            const endTime = getCellValue('endTime');
            const breakTimeDisplay = getCellValue('breakTime');
            const regie = getCellValue('regie');

            const breakMinutes = decimalHoursToMinutes(breakTimeDisplay);
            const breakTimeHHMM = breakMinutes && breakMinutes > 0 ? minutesToHHMM(breakMinutes) : '';
            
            // Always update these fields (even if empty, to allow clearing)
            originalMsg.workDate = workDate || originalMsg.workDate || '';
            originalMsg.startTime = startTime || '';
            originalMsg.endTime = endTime || '';
            originalMsg.breakTime = breakTimeHHMM || '';
            originalMsg.regie = regie || '';
            
            // Recalculate netto
            const nettoTime = calculateNettoTime(startTime, endTime, breakTimeHHMM);
            originalMsg.nettoTime = nettoTime || '';
        }
    });
}

// Update stats tables from DOM data
function updateStatsFromDOM() {
    const table = document.getElementById('messagesTable');
    if (!table) return;
    
    // Sync edits back to allParsedMessages first
    syncEditsToAllParsedMessages();
    
    // Use currentFilteredMessages if filters are active, otherwise use allParsedMessages
    // This ensures table and summary are always in sync
    const messagesForSummary = currentFilteredMessages !== null ? currentFilteredMessages : allParsedMessages;
    generateSummaryTables(messagesForSummary);
}

// Export to CSV: field separator `;`, decimal comma in duration columns (from DOM)
function exportToCSV() {
    const table = document.getElementById('messagesTable');
    if (!table) {
        alert('No table available for export.');
        return;
    }
    
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        alert('No data available for export.');
        return;
    }
    
    // CSV header (match displayed column order)
    const headers = [
        'Msg Date',
        'Msg Text',
        'Date',
        'Worker',
        'Start',
        'End',
        'Break',
        'Netto',
        'Regie'
    ];
    
    // Extract data from DOM (read edited values)
    const csvRows = Array.from(rows).map(row => {
        const getCellValue = (field) => {
            const cell = row.querySelector(`[data-field="${field}"]`);
            if (!cell) return '';
            // Remove HTML tags and get text content
            const text = cell.textContent || cell.innerText || '';
            return text.trim();
        };
        
        // Get message text from the last column (not editable)
        const messageCell = row.querySelector('.col-message');
        const messageText = messageCell ? (messageCell.textContent || messageCell.innerText || '').replace(/\n/g, ' ').trim() : '';
        
        return [
            getCellValue('msgDate'),
            messageText,
            getCellValue('date'),
            getCellValue('sender'),
            getCellValue('startTime'),
            getCellValue('endTime'),
            getCellValue('breakTime'),
            getCellValue('nettoTime'),
            getCellValue('regie')
        ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(';');
    });
    
    // Combine header and rows
    const csvContent = [
        headers.map(h => `"${h}"`).join(';'),
        ...csvRows
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `whatsapp-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Global variable to store all parsed messages
let allParsedMessages = [];
let currentFilteredMessages = null; // Track currently filtered messages for summary sync

// Convert dd.mm.yyyy to YYYY-MM-DD for date comparison
function parseDateToComparable(dateStr) {
    if (!dateStr) return null;
    
    // Handle dd.mm.yyyy format
    const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
    }
    
    // Handle dd.mm.yy format
    const match2 = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
    if (match2) {
        const year = '20' + match2[3];
        return `${year}-${match2[2]}-${match2[1]}`;
    }
    
    // Handle dd.mm format - use current year
    const match3 = dateStr.match(/^(\d{2})\.(\d{2})\.?$/);
    if (match3) {
        const year = new Date().getFullYear();
        return `${year}-${match3[2]}-${match3[1]}`;
    }
    
    // Handle YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return dateStr.split(' ')[0]; // Take only date part
    }
    
    return null;
}

// Filter messages by date range and worker
function filterMessages(messages, fromDate, toDate, worker) {
    return messages.filter(msg => {
        // Filter by date - only use dates from message body
        if (fromDate || toDate) {
            const msgDate = msg.workDate && msg.workDate !== 'N/A' ? msg.workDate : '';
            if (!msgDate) return false;
            
            const comparableDate = parseDateToComparable(formatDateToDDMMYYYY(msgDate));
            if (!comparableDate) return false;
            
            if (fromDate && comparableDate < fromDate) return false;
            if (toDate && comparableDate > toDate) return false;
        }
        
        // Filter by worker
        if (worker && worker !== '') {
            const msgWorker = msg.sender || 'Unknown';
            if (msgWorker !== worker) return false;
        }
        
        return true;
    });
}

// Find earliest date in messages
function findEarliestDate(messages) {
    let earliest = null;
    
    messages.forEach(msg => {
        // Only use dates from message body, never fallback to header date
        const msgDate = msg.workDate && msg.workDate !== 'N/A' ? msg.workDate : '';
        if (!msgDate) return;
        
        const comparableDate = parseDateToComparable(formatDateToDDMMYYYY(msgDate));
        if (comparableDate && (!earliest || comparableDate < earliest)) {
            earliest = comparableDate;
        }
    });
    
    return earliest;
}

// Apply filters (date and worker) and refresh display
function applyFilters() {
    const elements = getElements();
    if (!elements.fromDateInput || !elements.toDateInput || allParsedMessages.length === 0) return;
    
    // First, sync any edits from DOM back to allParsedMessages before filtering
    syncEditsToAllParsedMessages();
    
    const fromDate = elements.fromDateInput.value || null;
    const toDate = elements.toDateInput.value || null;
    const worker = elements.workerFilter ? elements.workerFilter.value || null : null;
    
    // Check if any filters are active
    const hasFilters = fromDate || toDate || (worker && worker !== '');
    
    // Filter messages if filters are active, otherwise use all messages
    const filteredMessages = hasFilters ? filterMessages(allParsedMessages, fromDate, toDate, worker) : allParsedMessages;
    
    // Store current filtered messages for summary sync
    currentFilteredMessages = hasFilters ? filteredMessages : null;
    
    // Re-display filtered messages
    displayFilteredMessages(filteredMessages);
}

// Display filtered messages (similar to original display logic but with filtered data)
function displayFilteredMessages(messages) {
    const messagesList = document.getElementById('messagesList');
    const statistics = document.getElementById('statistics');
    
    if (!messagesList || !statistics) return;
    
    // Update statistics
    const stats = analyzeMessages(messages);
    const allStats = analyzeMessages(allParsedMessages);
    statistics.innerHTML = `
        <h3>Statistics</h3>
        <div class="stat-item"><strong>Total Messages:</strong> ${allStats.total_messages || 0}</div>
        <div class="stat-item"><strong>Filtered Messages:</strong> ${messages.length} of ${allParsedMessages.length}</div>
        ${stats.date_range && stats.date_range.first ? `
            <div class="stat-item"><strong>Date Range (filtered):</strong> ${stats.date_range.first} to ${stats.date_range.last || stats.date_range.first}</div>
        ` : ''}
        <div class="stat-item"><strong>Messages per Person (filtered):</strong>
            <ul>
                ${stats.senders && Object.keys(stats.senders).length > 0 ? 
                    Object.entries(stats.senders).map(([sender, count]) => 
                        `<li>${sender}: ${count}</li>`
                    ).join('') : '<li>No senders found</li>'
                }
            </ul>
        </div>
    `;
    
    // Track seen work date + person combinations to identify duplicates
    const seenDatePersonCombos = new Set();
    
    const sortedMessages = messages.slice().sort((a, b) => {
        const workerA = (a.sender || 'Unknown').toLowerCase();
        const workerB = (b.sender || 'Unknown').toLowerCase();
        if (workerA < workerB) return -1;
        if (workerA > workerB) return 1;

        const workA = a.workDate && a.workDate !== 'N/A' ? formatDateToDDMMYYYY(a.workDate) : '';
        const workB = b.workDate && b.workDate !== 'N/A' ? formatDateToDDMMYYYY(b.workDate) : '';
        const compA = workA ? parseDateToComparable(workA) : null;
        const compB = workB ? parseDateToComparable(workB) : null;

        if (compA === null && compB === null) return 0;
        if (compA === null) return 1;
        if (compB === null) return -1;

        if (compA < compB) return -1;
        if (compA > compB) return 1;

        // Tie-breaker: start time then end time (keeps ordering deterministic)
        const startA = a.startTime ? parseTimeToMinutes(a.startTime) : 0;
        const startB = b.startTime ? parseTimeToMinutes(b.startTime) : 0;
        if (startA < startB) return -1;
        if (startA > startB) return 1;

        const endA = a.endTime ? parseTimeToMinutes(a.endTime) : 0;
        const endB = b.endTime ? parseTimeToMinutes(b.endTime) : 0;
        if (endA < endB) return -1;
        if (endA > endB) return 1;

        return (a.message || '').localeCompare(b.message || '');
    });
    
    const tableRows = sortedMessages.map((msg, index) => {
        // Only highlight if we have actual extracted values
        const hasExtractedData = msg.workDate || msg.startTime || msg.endTime || msg.breakTime || msg.regie;
        const highlightedMessage = hasExtractedData ? highlightMessage(msg.message, msg) : msg.message;
        
        const msgDateValue = formatDateToDDMMYYYY(msg.date || '');
        // Only use dates from message body, never fallback to header date
        const workDate = msg.workDate === 'N/A' ? '' : (msg.workDate || '');
        const dateValue = formatDateToDDMMYYYY(workDate);
        const sender = msg.sender || 'Unknown';
        
        // Check if this work date + person combination is a duplicate
        const normalizedWorkDate = formatDateToDDMMYYYY(workDate);
        const datePersonKey = `${normalizedWorkDate}_${sender}`;
        const isDuplicateDate = normalizedWorkDate && seenDatePersonCombos.has(datePersonKey);
        
        if (!isDuplicateDate && normalizedWorkDate) {
            seenDatePersonCombos.add(datePersonKey);
        }
        
        const isUnmatched = msg.unmatched || !msg.startTime || !msg.endTime;
        const formatCellValue = (value) => {
            if (value === 'N/A') return '<span style="color: #999; font-style: italic;">N/A</span>';
            return value || '';
        };

        const breakDecimalHours = msg.breakTime ? minutesToDecimalHours(parseTimeToMinutes(msg.breakTime)) : '';
        const nettoDecimalHours = msg.nettoTime ? minutesToDecimalHours(parseTimeToMinutes(msg.nettoTime)) : '';
        
        // Create unique key for matching: date_time_sender_message
        const uniqueKey = `${msg.date}_${msg.time}_${msg.sender}_${msg.message}`;
        
        // Check for duplicate date - mark red
        const dateCellStyle = isDuplicateDate ? ' style="color: #cc0000; font-weight: 600;"' : '';
        const dateCellContent = isDuplicateDate ? `<span style="color: #cc0000;">${dateValue}</span>` : dateValue;
        const msgDateCellStyle = dateCellStyle;
        const msgDateCellContent = isDuplicateDate ? `<span style="color: #cc0000;">${msgDateValue}</span>` : msgDateValue;
        
        return `
        <tr${isUnmatched ? ' style="background-color: #fff3cd;"' : ''} data-row-index="${index}" data-msg-key="${uniqueKey.replace(/"/g, '&quot;')}">
            <td class="col-msg-date" data-field="msgDate"${msgDateCellStyle}>${msgDateCellContent}</td>
            <td class="col-message">${highlightedMessage.replace(/\n/g, '<br>')}</td>
            <td class="col-date" data-field="date"${dateCellStyle}>${dateCellContent}</td>
            <td class="col-name" data-field="sender">${msg.sender || 'Unknown'}</td>
            <td class="col-start-time editable-number" contenteditable="true" data-field="startTime">${isDuplicateDate ? '' : formatCellValue(msg.startTime)}</td>
            <td class="col-end-time editable-number" contenteditable="true" data-field="endTime">${isDuplicateDate ? '' : formatCellValue(msg.endTime)}</td>
            <td class="col-break editable-number" contenteditable="true" data-field="breakTime">${isDuplicateDate ? '' : formatCellValue(breakDecimalHours)}</td>
            <td class="col-netto" data-field="nettoTime">${isDuplicateDate ? '' : formatCellValue(nettoDecimalHours)}</td>
            <td class="col-regie" data-field="regie">${isDuplicateDate ? '' : formatCellValue(msg.regie)}</td>
        </tr>
    `;
    }).join('');
    
    messagesList.innerHTML = tableRows;
    
    // Add event listeners for editable cells
    const editableCells = messagesList.querySelectorAll('td[contenteditable="true"]');
    editableCells.forEach(cell => {
        cell.addEventListener('blur', function() {
            const row = this.closest('tr');
            const field = this.getAttribute('data-field');
            
            // Get the updated value from the edited cell
            let updatedValue = (this.textContent || this.innerText || '').trim().replace(/N\/A/gi, '').replace(/<[^>]*>/g, '');
            
            // Validate input format
            let isValid = true;
            let errorMessage = '';
            
            if (['startTime', 'endTime'].includes(field)) {
                if (updatedValue && !validateTimeFormat(updatedValue)) {
                    isValid = false;
                    errorMessage = 'Invalid time format. Please use HH:MM (e.g., 08:30)';
                }
            }

            if (field === 'breakTime' && updatedValue) {
                const breakMinutes = decimalHoursToMinutes(updatedValue);
                if (breakMinutes === null) {
                    isValid = false;
                    errorMessage = 'Invalid break duration format. Please use decimal hours (e.g., 0.5, 1.25)';
                }
            }
            
            if (!isValid) {
                alert(errorMessage);
                // Restore previous value or clear if invalid
                this.textContent = '';
                this.focus();
                return;
            }
            
            // Recalculate netto if start, end, or break changed
            if (['startTime', 'endTime', 'breakTime'].includes(field)) {
                const startCell = row.querySelector('[data-field="startTime"]');
                const endCell = row.querySelector('[data-field="endTime"]');
                const breakCell = row.querySelector('[data-field="breakTime"]');
                const nettoCell = row.querySelector('[data-field="nettoTime"]');
                
                if (nettoCell) {
                    // Use the updated value for the current cell, others from DOM
                    const startTime = field === 'startTime' ? updatedValue : (startCell?.textContent || '').trim().replace(/N\/A/gi, '').replace(/<[^>]*>/g, '');
                    const endTime = field === 'endTime' ? updatedValue : (endCell?.textContent || '').trim().replace(/N\/A/gi, '').replace(/<[^>]*>/g, '');
                    const breakTime = field === 'breakTime' ? updatedValue : (breakCell?.textContent || '').trim().replace(/N\/A/gi, '').replace(/<[^>]*>/g, '');
                    
                    // Validate and recalculate netto (duration-based, breakTime is decimal hours)
                    if (startTime && endTime) {
                        const startMinutes = parseTimeToMinutes(startTime);
                        const endMinutes = parseTimeToMinutes(endTime);
                        const breakMinutes = decimalHoursToMinutes(breakTime) || 0;

                        if (startMinutes && endMinutes) {
                            let totalMinutes = endMinutes - startMinutes;
                            if (totalMinutes < 0) {
                                totalMinutes += 24 * 60; // Overnight shift
                            }

                            // Break time must be less than the total duration (end - start)
                            if (breakMinutes >= totalMinutes) {
                                const totalDuration = minutesToHHMM(totalMinutes);
                                alert(`Invalid break duration: Break (${breakTime || '0'}) must be less than the work duration (${totalDuration}).\nStart: ${startTime}, End: ${endTime}, Duration: ${totalDuration}`);
                                this.textContent = '';
                                this.focus();
                                return;
                            }

                            const nettoMinutes = totalMinutes - breakMinutes;
                            nettoCell.textContent = nettoMinutes > 0 ? minutesToDecimalHours(nettoMinutes) : '';
                        }
                    }
                    
                    // Update row formatting based on whether both start and end times are present
                    const isUnmatched = !startTime || !endTime;
                    if (isUnmatched) {
                        row.style.backgroundColor = '#fff3cd';
                    } else {
                        row.style.backgroundColor = '';
                    }
                }
            }
            
            // Always update stats tables after any edit
            updateStatsFromDOM();
        });
    });
    
    // Generate summary tables - will use currentFilteredMessages if filters are active
    updateStatsFromDOM();
    
    // Log number of rows added to table
    const rowCount = messages.length;
    const parseLogContent = document.getElementById('parseLogContent');
    if (parseLogContent) {
        const currentLog = parseLogContent.textContent || '';
        parseLogContent.textContent = currentLog + `\n\n=== Table Display (Filtered) ===\nRows added to table: ${rowCount}\nFiltered from ${allParsedMessages.length} total messages`;
        parseLogContent.scrollTop = parseLogContent.scrollHeight;
    }
}

// Cache DOM elements
const getElements = () => ({
    form: document.getElementById('parseForm'),
    fileInput: document.getElementById('fileInput'),
    fileName: document.getElementById('fileName'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    results: document.getElementById('results'),
    statistics: document.getElementById('statistics'),
    messagesList: document.getElementById('messagesList'),
    fromDateInput: document.getElementById('fromDate'),
    toDateInput: document.getElementById('toDate'),
    workerFilter: document.getElementById('workerFilter'),
    dateFilter: document.getElementById('dateFilter'),
    exportBtn: document.getElementById('exportBtn'),
    gotoDateInput: document.getElementById('gotoDate'),
    gotoDateBtn: document.getElementById('gotoDateBtn')
});

// Setup filter event listeners (only once)
let filtersInitialized = false;
function setupFilterListeners() {
    if (filtersInitialized) return;
    filtersInitialized = true;
    
    const elements = getElements();
    if (elements.fromDateInput) {
        elements.fromDateInput.addEventListener('change', applyFilters);
    }
    if (elements.toDateInput) {
        elements.toDateInput.addEventListener('change', applyFilters);
    }
    if (elements.workerFilter) {
        elements.workerFilter.addEventListener('change', applyFilters);
    }
    if (elements.gotoDateInput) {
        elements.gotoDateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                scrollToDate();
            }
        });
    }
    if (elements.gotoDateBtn) {
        elements.gotoDateBtn.addEventListener('click', scrollToDate);
    }
    if (elements.exportBtn) {
        elements.exportBtn.onclick = () => exportToCSV();
    }
}

// Form handler
document.addEventListener('DOMContentLoaded', () => {
    const elements = getElements();
    if (!elements.form || !elements.fileInput || !elements.fileName) {
        return;
    }

    elements.fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            elements.fileName.textContent = e.target.files[0].name;
            
            if (!elements.loading || !elements.error || !elements.results || 
                !elements.statistics || !elements.messagesList) {
                return;
            }
                
            elements.loading.style.display = 'block';
            elements.error.style.display = 'none';
            elements.results.style.display = 'none';

            try {
                const data = await parseUploadedFile(e.target.files[0]);

                if (data.error) {
                    elements.error.textContent = data.error + (data.details ? ': ' + data.details : '');
                    elements.error.style.display = 'block';
                } else if (data.success) {
                    // Store all parsed messages globally
                    allParsedMessages = data.messages || [];
                    currentFilteredMessages = null; // Reset filters when new data is loaded
                    
                    // Find earliest date and set default filter values
                    const earliestDate = findEarliestDate(allParsedMessages);
                    const today = new Date().toISOString().split('T')[0];
                    
                    if (elements.fromDateInput && earliestDate) {
                        elements.fromDateInput.value = earliestDate;
                    }
                    if (elements.toDateInput) {
                        elements.toDateInput.value = today;
                    }
                    
                    // Show date filter
                    if (elements.dateFilter) {
                        elements.dateFilter.style.display = 'block';
                    }
                    
                    // Populate worker filter dropdown
                    if (elements.workerFilter && allParsedMessages.length > 0) {
                        // Clear existing options except "All Workers"
                        elements.workerFilter.innerHTML = '<option value="">All Workers</option>';
                        
                        // Get unique worker names
                        const uniqueWorkers = [...new Set(allParsedMessages.map(msg => msg.sender || 'Unknown').filter(s => s))].sort();
                        uniqueWorkers.forEach(worker => {
                            const option = document.createElement('option');
                            option.value = worker;
                            option.textContent = worker;
                            elements.workerFilter.appendChild(option);
                        });
                    }
                    
                    // Setup filter listeners (only once)
                    setupFilterListeners();
                    
                    // Prefill goto date with today
                    if (elements.gotoDateInput) {
                        elements.gotoDateInput.value = today;
                    }
                    
                    // Apply initial filter and display
                    applyFilters();

                    elements.results.style.display = 'block';
                    
                    // Store messages data for export
                    window.parsedMessages = data.messages;
                } else {
                    elements.error.textContent = 'Unknown error while parsing.';
                    elements.error.style.display = 'block';
                }
            } catch (err) {
                elements.error.textContent = 'Error: ' + err.message;
                elements.error.style.display = 'block';
            } finally {
                elements.loading.style.display = 'none';
            }
        } else {
            elements.fileName.textContent = 'No file selected';
        }
    });
    
    // Prevent form submission (parsing happens on file selection)
    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
    });
});
