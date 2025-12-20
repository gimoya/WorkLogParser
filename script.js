// ========== CONSTANTS ==========
const BREAK_DURATION_PATTERNS = [
    /\b(\d+\.\d+)\s*(?:hr|hrs|h)\b/i,
    /\b(\d+\/\d+)\s*(?:hr|hrs|h)?\b/i,
    /\b(\d+)\s*'/,
    /\b(\d+)\s*(?:hr|hrs|h)(?!\w)/i,
    /\b(\d+)\s*min\b/i,
    /\b(\d+)\s*minute/i,
    /\b(\d+)\s*minuten/i
];

const REGIE_DURATION_PATTERNS = [
    /\b(\d+\/\d+)\s*(?:hr|hrs|h)?/i,
    /\b(\d+\.\d+)\s*(?:hr|hrs|h)\b/i,
    /\b(\d+)\s*(?:hr|hrs|h)\b/i,
    /\b(\d+)\s*min\b/i
];

const BREAK_CONTEXT_KEYWORDS = /\b(break|lunch|pause|tea|rest|lunch\s*[+&]\s*tea)\b/i;
const REGIE_KEYWORD = /\bregie\b/i;
// Shared regie type keyword patterns (ordered longest to shortest for proper matching)
// These patterns are used both for extraction and highlighting
const REGIE_TYPE_KEYWORD_PATTERNS = [
    /\bmaterial\s+transport\b/gi,
    /\bcutting\s+trees?\b/gi,
    /\bcutting\s+bushes\b/gi,
    /\bcutting\s+branches\b/gi,
    /\bfallen\s+trees?\b/gi,
    /\bcut\s+trees?\b/gi,
    /\bcut\s+bushes\b/gi,
    /\bcut\s+branches\b/gi,
    /\bchainsaw\s+cutting\b/gi,
    /\bwood\b/gi,
    /\bbushes\b/gi,
    /\bbranches\b/gi
];
// Combined regex for highlighting (includes "regie" keyword)
const REGIE_TYPE_KEYWORDS = /\b(regie|material\s+transport|cutting\s+trees?|cutting\s+bushes|cutting\s+branches|fallen\s+trees?|cut\s+trees?|cut\s+bushes|cut\s+branches|moving\s+branches?|chainsaw\s+cutting|wood\s+clearing|clearing\s+wood|wood|clearing|bushes|branches)\b/i;
const TIME_RANGE_PATTERN = /(\d{1,2})\s*:\s*(\d{2})\s*-\s*(\d{1,2})\s*:\s*(\d{2})/;
const TIME_PATTERN = /\b(\d{1,2})\s*:\s*(\d{2})\b/g;

// Date patterns - allow single or double digits for day and month
const DATE_PATTERN_DASH_SLASH = /:\s*(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\.?)\s*[-/]/;
const DATE_PATTERN_WITH_TIME = /:\s*(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\.?)\s+(?=\d{1,2}\s*:\s*\d{2})/;
const DATE_PATTERN_AFTER_COLON = /:\s*(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\.?)(?=\s|\n|$|[^\d])/;
const DATE_PATTERN_START = /^(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\.?)(?=\s|\n|$|[^\d])/;
const DATE_PATTERN_START_WS = /^\s+(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\.?)(?=\s|\n|$|[^\d])/;
const DATE_PATTERN_GENERAL = /(?:^|\s|:)(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\.?)(?=\s|\n|$|[^\d])/m;
const DATE_PATTERN_ALL = /(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\.?)(?=\s|$|[^\d])/g;

// ========== HELPER FUNCTIONS ==========
function formatDateToDDMMYYYY(dateStr) {
    if (!dateStr) return '';
    
    // If already in dd.mm.yyyy format, return as is
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
        return dateStr;
    }
    
    // If in d.m or d.m. or dd.m or d.mm format (single or double digits), normalize and add current year
    if (/^\d{1,2}\.\d{1,2}\.?$/.test(dateStr)) {
        const parts = dateStr.replace(/\.$/, '').split('.');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = new Date().getFullYear();
        return `${day}.${month}.${year}`;
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

function calculateNettoTime(startTime, endTime, breakTime, regieTime = '') {
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
        // Netto = (end - start) - break (no subtraction of regie-hrs)
        const nettoMinutes = totalMinutes - breakMinutes;
        return nettoMinutes > 0 ? minutesToHHMM(nettoMinutes) : '';
    } catch (e) {
        return '';
    }
}

// Validate date format dd.mm.yyyy
function validateDateFormat(dateStr) {
    if (!dateStr || dateStr.trim() === '') return true; // Empty is valid
    const pattern = /^\d{2}\.\d{2}\.\d{4}$/;
    return pattern.test(dateStr.trim());
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

// Check if regie-hrs <= netto
function validateRegieVsNetto(regieTime, nettoTime) {
    if (!regieTime || !nettoTime) return true; // Empty is valid
    
    const regieMinutes = parseTimeToMinutes(regieTime);
    const nettoMinutes = parseTimeToMinutes(nettoTime);
    
    if (!regieMinutes || !nettoMinutes) return true; // Invalid times are handled elsewhere
    
    return regieMinutes <= nettoMinutes;
}

// Extract date matches from text using all date patterns
function findDateMatches(text) {
    const dateMatches = [];
    
    // Pattern 1: Date followed by dash or slash
    const match1 = text.match(DATE_PATTERN_DASH_SLASH);
    if (match1) {
        dateMatches.push({
            date: match1[1].replace(/\.$/, ''),
            index: match1.index + match1[0].indexOf(match1[1])
        });
        return dateMatches;
    }
    
    // Pattern 2: Date followed by space and time
    const match2 = text.match(DATE_PATTERN_WITH_TIME);
    if (match2) {
        dateMatches.push({
            date: match2[1].replace(/\.$/, ''),
            index: match2.index + match2[0].indexOf(match2[1])
        });
        return dateMatches;
    }
    
    // Pattern 3a: Date after colon
    const match3a = text.match(DATE_PATTERN_AFTER_COLON);
    if (match3a) {
        dateMatches.push({
            date: match3a[1].replace(/\.$/, ''),
            index: match3a.index + match3a[0].indexOf(match3a[1])
        });
        return dateMatches;
    }
    
    // Pattern 3b: Date at start
    const match3bStart = text.match(DATE_PATTERN_START);
    if (match3bStart) {
        dateMatches.push({
            date: match3bStart[1].replace(/\.$/, ''),
            index: match3bStart.index
        });
        return dateMatches;
    }
    
    // Pattern 3b: Date after whitespace at start
    const match3bStartWS = text.match(DATE_PATTERN_START_WS);
    if (match3bStartWS) {
        dateMatches.push({
            date: match3bStartWS[1].replace(/\.$/, ''),
            index: match3bStartWS.index + (match3bStartWS[0].length - match3bStartWS[1].length)
        });
        return dateMatches;
    }
    
    // Pattern 3b: Date after space or colon anywhere
    const match3b = text.match(DATE_PATTERN_GENERAL);
    if (match3b) {
        const dateIndex = match3b.index + (match3b[0][0] === ' ' || match3b[0][0] === ':' ? 1 : 0);
        dateMatches.push({
            date: match3b[1].replace(/\.$/, ''),
            index: dateIndex
        });
    }
    
    return dateMatches;
}

// Extract times from text
function extractTimesFromText(text) {
    const times = [];
    const timeRangeMatch = text.match(TIME_RANGE_PATTERN);
    if (timeRangeMatch) {
        return {
            startTime: normalizeTime(`${timeRangeMatch[1]}:${timeRangeMatch[2]}`),
            endTime: normalizeTime(`${timeRangeMatch[3]}:${timeRangeMatch[4]}`),
            timeRangeText: timeRangeMatch[0]
        };
    }
    
    // Extract individual times
    TIME_PATTERN.lastIndex = 0;
    let timeMatch;
    while ((timeMatch = TIME_PATTERN.exec(text)) !== null) {
        times.push(normalizeTime(`${timeMatch[1]}:${timeMatch[2]}`));
    }
    
    if (times.length >= 2) {
        return { startTime: times[0], endTime: times[1] };
    } else if (times.length === 1) {
        return { startTime: times[0] };
    }
    
    return {};
}

// Extract break, regie, and calculate netto from text
function extractTimeDetails(text, entry) {
    if (!entry.startTime && !entry.endTime) return;
    
    // Extract break time
    const breakData = extractBreakTime(text, entry.breakTime);
    if (breakData.minutes > 0) {
        entry.breakTime = minutesToHHMM(breakData.minutes);
        if (breakData.originalText) {
            entry.breakOriginalText = breakData.originalText;
        }
    }
    
    // Extract regie entries
    const regieEntries = extractRegieEntries(text);
    const regieData = processRegieEntries(regieEntries);
    if (regieData.regieTime) {
        entry.regieTime = regieData.regieTime;
        entry.regieOriginalText = regieData.regieOriginalText;
    }
    
    // Calculate netto time
    if (entry.startTime && entry.endTime) {
        entry.nettoTime = calculateNettoTime(
            entry.startTime,
            entry.endTime,
            entry.breakTime,
            '' // Netto doesn't subtract regie
        );
    }
}

function parseDurationValue(matchValue, patternSource) {
    if (matchValue.includes('.')) {
        return parseFloat(matchValue) * 60; // Decimal format: 0.75hrs
    } else if (matchValue.includes('/')) {
        const [num, den] = matchValue.split('/').map(Number);
        return (num / den) * 60; // Fraction format: 1/2 h
    } else {
        const num = parseInt(matchValue);
        if (patternSource.includes('hr') || patternSource.includes('h\\b')) {
            return num * 60; // Hours
        } else if (patternSource.includes("'")) {
            return num; // Apostrophe format: minutes
        } else {
            return num; // Minutes
        }
    }
}

function extractBreakTime(text, existingBreakTime = '') {
    // First try to extract from text (prioritize text over existing value)
    for (const pattern of BREAK_DURATION_PATTERNS) {
        const allMatches = [...text.matchAll(new RegExp(pattern.source, 'gi'))];
        for (const breakMatch of allMatches) {
            const breakIndex = breakMatch.index;
            // Check up to 20 chars after the duration to catch "lunch+tea" or "lunch & tea"
            const endIdx = Math.min(text.length, breakIndex + breakMatch[0].length + 20);
            const context = text.substring(breakIndex + breakMatch[0].length, endIdx);

            // Case 1: Has break context keyword (lunch, tea, break, etc.)
            const contextMatch = context.match(BREAK_CONTEXT_KEYWORDS);
            if (contextMatch) {
                // Store both the duration and the context keyword for highlighting
                // Include the text from breakMatch to the end of the context keyword
                const contextKeyword = contextMatch[0];
                const textAfterDuration = context.substring(0, contextMatch.index + contextKeyword.length);
                const fullBreakText = breakMatch[0] + textAfterDuration;
                return {
                    minutes: parseDurationValue(breakMatch[1], pattern.source),
                    originalText: fullBreakText.trim() // Store duration + context keyword for highlighting
                };
            }
            
            // Case 2: Duration appears right after a time range (within 20 chars before)
            // Check if there's a time range pattern before this duration
            const startCheck = Math.max(0, breakIndex - 20);
            const textBeforeDuration = text.substring(startCheck, breakIndex);
            // Look for time range pattern (e.g., "08:00-17:00" or "08:00 - 17:00")
            const timeRangeBefore = /(\d{1,2})\s*:\s*(\d{2})\s*-\s*(\d{1,2})\s*:\s*(\d{2})/.test(textBeforeDuration);
            if (timeRangeBefore) {
                // Duration after time range - treat as break time even without keywords
                return {
                    minutes: parseDurationValue(breakMatch[1], pattern.source),
                    originalText: breakMatch[0] // Store original pattern text for highlighting
                };
            }
        }
    }
    
    // If nothing found in text, parse existing breakTime to minutes
    if (existingBreakTime) {
        let minutes = 0;
        if (existingBreakTime.includes(':')) {
            minutes = parseTimeToMinutes(existingBreakTime);
        } else if (existingBreakTime.includes('/')) {
            const [num, den] = existingBreakTime.split('/').map(Number);
            minutes = (num / den) * 60;
        } else if (existingBreakTime.includes('hr') || existingBreakTime.includes('h')) {
            minutes = parseFloat(existingBreakTime) * 60;
        } else {
            minutes = parseInt(existingBreakTime) || 0;
        }
        return {
            minutes: minutes,
            originalText: existingBreakTime // Use existing as original if no new match found
        };
    }
    
    return { minutes: 0, originalText: '' };
}

function extractRegieEntries(text) {
    const regieEntries = [];
    const matchedRanges = []; // Track matched ranges to prevent overlapping matches
    
    for (const pattern of REGIE_DURATION_PATTERNS) {
        const allMatches = [...text.matchAll(new RegExp(pattern.source, 'gi'))];
        for (const regieMatch of allMatches) {
            const regieIndex = regieMatch.index;
            const regieEnd = regieIndex + regieMatch[0].length;
            
            // Check if this match overlaps with any previously matched range
            const overlaps = matchedRanges.some(range => 
                (regieIndex >= range.start && regieIndex < range.end) ||
                (regieEnd > range.start && regieEnd <= range.end) ||
                (regieIndex <= range.start && regieEnd >= range.end)
            );
            
            if (overlaps) continue; // Skip overlapping matches
            
            const endIdx = Math.min(text.length, regieEnd + 15);
            const context = text.substring(regieEnd, endIdx);

            const regieMatchInContext = context.match(REGIE_KEYWORD);
            if (regieMatchInContext) {
                const regieMinutes = parseDurationValue(regieMatch[1], pattern.source);
                const regieTime = minutesToHHMM(regieMinutes);

                regieEntries.push({
                    time: regieTime,
                    minutes: regieMinutes,
                    originalText: regieMatch[0]
                });
                
                // Mark this range as matched
                matchedRanges.push({ start: regieIndex, end: regieEnd });
            }
        }
    }
    return regieEntries;
}

function processRegieEntries(regieEntries) {
    if (regieEntries.length === 0) return { regieTime: '', regieOriginalText: '' };

    if (regieEntries.length === 1) {
        return {
            regieTime: regieEntries[0].time,
            regieOriginalText: regieEntries[0].originalText
        };
    } else {
        // Sum all regie times
        const totalRegieMinutes = regieEntries.reduce((sum, e) => sum + e.minutes, 0);
        return {
            regieTime: minutesToHHMM(totalRegieMinutes),
            regieOriginalText: regieEntries.map(e => e.originalText).join('|')
        };
    }
}

function createEmptyEntry() {
    return {
        workDate: '',
        startTime: '',
        endTime: '',
        timeRangeOriginalText: '', // Store original time range text (e.g., "13:30-16:00") for highlighting
        breakTime: '',
        breakOriginalText: '', // Store original pattern text for highlighting
        nettoTime: '',
        regieTime: '',
        regieOriginalText: ''
    };
}

// Parse message header and create date object
function parseMessageHeader(dateStr, timeStr) {
    const [day, month, yearStr] = dateStr.split('.');
    const year = yearStr.length === 2 ? '20' + yearStr : yearStr;
    const fullTime = timeStr + ':00';
    const date = new Date(`${year}-${month}-${day}T${fullTime}`);
    return isNaN(date.getTime()) ? null : date;
}

// Process a single message and extract work info
function processMessage(message, dateStr, timeStr, sender, log) {
    const date = parseMessageHeader(dateStr, timeStr);
    if (!date) {
        log(`  ✗ Invalid date: ${dateStr}`);
        return null;
    }
    
    log(`  Message preview: "${message.substring(0, 100).replace(/\n/g, '\\n')}..."`);
    const workEntries = extractWorkInfo(message, log);
    const workInfo = workEntries.length > 0 ? workEntries[0] : createEmptyEntry();
    
    const hasData = workInfo.workDate || workInfo.startTime || workInfo.endTime || 
                   workInfo.breakTime || workInfo.regieTime;
    if (hasData) {
        log(`  ✓ Extracted: date=${workInfo.workDate || 'none'}, time=${workInfo.startTime || 'none'}-${workInfo.endTime || 'none'}, break=${workInfo.breakTime || 'none'}, regie=${workInfo.regieTime || 'none'}`);
    } else {
        log(`  ⚠ No fields extracted from message`);
        log(`  Message content: "${message.substring(0, 200).replace(/\n/g, '\\n')}..."`);
    }
    
    return createMessageEntry(dateStr, timeStr, sender, message, workInfo, date);
}

function createMessageEntry(dateStr, timeStr, sender, message, workInfo, date) {
    // For fuzzy/fallback path: if no date found in message body, use message header date
    // For structured format: workDate is always set, so this fallback won't apply
    let workDate = workInfo.workDate ? formatDateToDDMMYYYY(workInfo.workDate) : '';
    if (!workDate && !workInfo.structuredFormatMatch) {
        // Fallback to message header date for fuzzy path only
        workDate = formatDateToDDMMYYYY(dateStr);
    }
    
    return {
        timestamp: date.toISOString(),
        date: dateStr,
        time: timeStr,
        sender: sender.trim(),
        message: message.trim(),
        workDate: workDate,
        startTime: workInfo.startTime,
        endTime: workInfo.endTime,
        timeRangeOriginalText: workInfo.timeRangeOriginalText || '',
        breakTime: workInfo.breakTime,
        breakOriginalText: workInfo.breakOriginalText || '',
        nettoTime: workInfo.nettoTime,
        regieTime: workInfo.regieTime,
        regieOriginalText: workInfo.regieOriginalText || '',
        additionalDates: workInfo.additionalDates || [],
        structuredFormatMatch: workInfo.structuredFormatMatch || null,
        dateOriginalText: workInfo.dateOriginalText || null,
        dateMatchIndex: workInfo.dateMatchIndex !== undefined ? workInfo.dateMatchIndex : null
    };
}

function updateWorkInfoFromEntry(target, source) {
    if (source.workDate && !target.workDate) target.workDate = source.workDate;
    if (source.startTime && !target.startTime) target.startTime = source.startTime;
    if (source.endTime && !target.endTime) target.endTime = source.endTime;
    if (source.timeRangeOriginalText && !target.timeRangeOriginalText) {
        target.timeRangeOriginalText = source.timeRangeOriginalText;
    }
    if (source.breakTime && !target.breakTime) {
        target.breakTime = source.breakTime;
        target.breakOriginalText = source.breakOriginalText || '';
    }
    if (source.nettoTime && !target.nettoTime) target.nettoTime = source.nettoTime;
    if (source.regieTime && !target.regieTime) {
        target.regieTime = source.regieTime;
        target.regieOriginalText = source.regieOriginalText || '';
    }
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

// Highlight matched portions in message text - DO NOT ALTER TEXT, only wrap in spans
function highlightMessage(message, workEntries) {
    if (!workEntries || workEntries.length === 0) return message;
    
    // Check if we have any actual extracted data
    const hasData = workEntries.some(entry => 
        entry.workDate?.trim() || entry.startTime?.trim() || entry.endTime?.trim() ||
        entry.breakTime?.trim() || entry.regieTime?.trim() || entry.regieType?.trim()
    );
    if (!hasData) return message;
    
    const highlightRanges = [];
    
    // Check if any entry has structured format match - if so, skip date matching logic
    const hasStructuredFormat = workEntries.some(entry => entry.structuredFormatMatch);
    
    // Find all date matches in message (only if no structured format match)
    if (!hasStructuredFormat) {
        const dateMatches = [];
        DATE_PATTERN_ALL.lastIndex = 0;
        let allDateMatch;
        while ((allDateMatch = DATE_PATTERN_ALL.exec(message)) !== null) {
            const dateStr = allDateMatch[1].replace(/\.$/, '');
            const dateIndex = allDateMatch.index;
            // Avoid duplicates (same position)
            const alreadyFound = dateMatches.some(dm => Math.abs(dm.index - dateIndex) < 3);
            if (!alreadyFound) {
                dateMatches.push({
                    date: dateStr,
                    index: dateIndex,
                    fullMatch: allDateMatch[0]
                });
            }
        }
        dateMatches.sort((a, b) => a.index - b.index);
        
        // If we have multiple dates, mark second and subsequent dates as warnings
        if (dateMatches.length > 1) {
            // Get the first extracted date from work entry
            const firstExtractedDate = workEntries[0]?.workDate;
            
            // Find which date match corresponds to the first extracted date
            let firstDateMatchIndex = 0;
            if (firstExtractedDate) {
                const foundIndex = dateMatches.findIndex(dm => dm.date === firstExtractedDate);
                if (foundIndex >= 0) {
                    firstDateMatchIndex = foundIndex;
                }
            }
            
            // Mark all dates after the first one as warnings (red highlight)
            for (let i = firstDateMatchIndex + 1; i < dateMatches.length; i++) {
                const dm = dateMatches[i];
                highlightRanges.push({
                    start: dm.index,
                    end: dm.index + dm.fullMatch.length,
                    text: dm.fullMatch,
                    warning: true
                });
            }
        }
    }
    const addMatches = (text, pattern, limitToFirst = false) => {
        if (!text?.trim()) return;
        const regex = new RegExp(pattern, 'gi');
        let match;
        let matchCount = 0;
        while ((match = regex.exec(message)) !== null) {
            highlightRanges.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
            matchCount++;
            if (limitToFirst && matchCount >= 1) break; // Only match first occurrence
        }
    };
    
    workEntries.forEach(entry => {
        // If structured format was matched, highlight the entire structured pattern (literal match)
        if (entry.structuredFormatMatch) {
            const sf = entry.structuredFormatMatch;
            highlightRanges.push({
                start: sf.index,
                end: sf.index + sf.fullText.length,
                text: sf.fullText,
                isStructured: true // Mark as structured format match for priority
            });
            // Skip all individual highlights - they're already part of the fullText literal match
        } else {
            // Only do individual highlights if structured format wasn't matched
            // Highlight date - use original match if available, otherwise search for normalized date
            if (entry.dateOriginalText && entry.dateMatchIndex !== null) {
                // Use the original date match for precise highlighting
                highlightRanges.push({
                    start: entry.dateMatchIndex,
                    end: entry.dateMatchIndex + entry.dateOriginalText.length,
                    text: entry.dateOriginalText
                });
            } else if (entry.workDate?.trim()) {
                // Fallback: search for normalized date
                addMatches(entry.workDate, `\\b${entry.workDate.replace(/\./g, '\\.')}\\b`);
            }
            // If we have a time range original text, highlight only that (to avoid matching other occurrences)
            if (entry.timeRangeOriginalText?.trim()) {
                const escapedRange = entry.timeRangeOriginalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                addMatches(entry.timeRangeOriginalText, escapedRange);
            } else {
                // Fallback: highlight individual times (but this might match multiple occurrences)
                if (entry.startTime?.trim()) {
                    const escapedTime = entry.startTime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    addMatches(entry.startTime, escapedTime);
                }
                if (entry.endTime?.trim()) {
                    const escapedTime = entry.endTime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    addMatches(entry.endTime, escapedTime);
                }
            }
            if (entry.breakTime?.trim()) {
                // Use original text pattern if available (e.g., "1h", "45'", "1/2 hr", "45' lunch")
                if (entry.breakOriginalText?.trim()) {
                    // Escape special regex characters, but keep apostrophe as-is (it's safe in regex)
                    const escapedText = entry.breakOriginalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Make whitespace flexible for matching (handles "45'  lunch" or "45' lunch")
                    const patternWithSpaces = escapedText.replace(/\s+/g, '\\s+');
                    // Match the pattern with word boundary at the end to prevent partial matches
                    // Don't require word boundary at start (might have punctuation like period before it)
                    const pattern = patternWithSpaces + '\\b';
                    addMatches(entry.breakOriginalText, pattern, true);
                } else {
                    // Fallback: try to match formatted time (less reliable)
                    const breakMatch = entry.breakTime.match(/(\d+(?:\/\d+)?(?:\.\d+)?)\s*(?:hr|hrs|h|min|'|minute|minuten)?/i);
                    if (breakMatch) {
                        addMatches(breakMatch[0], `\\b${breakMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, true);
                    }
                }
            }
            if (entry.regieTime?.trim()) {
                if (entry.regieOriginalText?.trim()) {
                    entry.regieOriginalText.split('|').forEach(originalText => {
                        // Only match first occurrence of each regie entry, use word boundaries
                        const escapedText = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const pattern = `\\b${escapedText.replace(/\s+/g, '\\s+')}\\b`;
                        addMatches(originalText, pattern, true);
                    });
                } else {
                    addMatches(entry.regieTime, `\\b${entry.regieTime.replace(':', '\\:')}\\b`, true);
                }
            }
            // Highlight additional dates found after first extracted date
            if (entry.additionalDates && entry.additionalDates.length > 0) {
                entry.additionalDates.forEach(additionalDate => {
                    highlightRanges.push({
                        start: additionalDate.index,
                        end: additionalDate.index + additionalDate.fullMatch.length,
                        text: additionalDate.fullMatch,
                        warning: true
                    });
                });
            }
        }
        
        // Check if regie time is empty but regie keywords are found - mark in light red
        // This should run regardless of whether structured format matched (e.g., if regie wasn't extracted from structured format)
        if (!entry.regieTime?.trim()) {
            const regieTypeKeywordsGlobal = new RegExp(REGIE_TYPE_KEYWORDS.source, 'gi');
            const regieKeywordMatches = [...message.matchAll(regieTypeKeywordsGlobal)];
            for (const regieMatch of regieKeywordMatches) {
                // Check if this keyword is not already part of a highlighted range
                const alreadyHighlighted = highlightRanges.some(r => 
                    regieMatch.index >= r.start && regieMatch.index < r.end
                );
                if (!alreadyHighlighted) {
                    highlightRanges.push({ 
                        start: regieMatch.index, 
                        end: regieMatch.index + regieMatch[0].length, 
                        text: regieMatch[0],
                        warning: true // Mark as warning highlight
                    });
                }
            }
        }
    });
    
    // Sort ranges by start position (descending) to apply from end to start
    highlightRanges.sort((a, b) => b.start - a.start);
    
    // Remove overlapping ranges (prioritize structured format matches and warnings)
    // Sort: structured format matches first (keep them), then warnings last (they override), then by start position
    highlightRanges.sort((a, b) => {
        const aIsStructured = a.isStructured || false;
        const bIsStructured = b.isStructured || false;
        if (aIsStructured !== bIsStructured) return aIsStructured ? -1 : 1; // Structured format first
        if (a.warning !== b.warning) return a.warning ? 1 : -1; // Warnings last
        return a.start - b.start;
    });
    
    const nonOverlapping = [];
    for (const range of highlightRanges) {
        // If this is a structured format match, check if it's completely contained in an existing range
        // Otherwise, check for any overlap
        const overlaps = nonOverlapping.some(r => {
            if (range.isStructured) {
                // For structured format, only remove if completely contained in another structured format
                return r.isStructured && range.start >= r.start && range.end <= r.end;
            }
            // For other ranges, check normal overlap
            return (range.start >= r.start && range.start < r.end) ||
                   (range.end > r.start && range.end <= r.end) ||
                   (range.start <= r.start && range.end >= r.end);
        });
        if (!overlaps) nonOverlapping.push(range);
    }
    
    // Re-sort by start position (descending) for applying highlights
    nonOverlapping.sort((a, b) => b.start - a.start);
    
    // Apply highlights from end to start to preserve indices
    let highlighted = message;
    for (const range of nonOverlapping) {
        const className = range.warning ? 'message-highlight-warning' : 'message-highlight';
        highlighted = highlighted.substring(0, range.start) +
            `<span class="${className}">` + range.text + '</span>' +
            highlighted.substring(range.end);
    }
    
    return highlighted;
}

// Extract work information from message body - returns first entry found
function extractWorkInfo(message, logCallback = null) {
    let entry = createEmptyEntry();
    const log = (msg) => {
        if (logCallback) logCallback(msg);
    };
    
    // FIRST: Try structured format: "18.11., 08:00, 14:00, break: 30, regie: 90, regie-type: wood, Work Description"
    // Format: dd.mm., H:MM or HH:MM, H:MM or HH:MM, break: MM, reg:anything MM (or time format), reg:anything-type: text, description
    // Whitespace-insensitive: matches with any amount/type of whitespace (including newlines) or none
    // Structured pattern - allow newlines and any whitespace everywhere, make commas optional
    // Use [\s\n]* everywhere instead of \s* to allow newlines, and make commas optional
    // Regie matching: "reg" followed by anything (handles typos like "reggie") then digit/time format, optionally followed by "hr"/"hrs"
    // Date pattern allows single or double digits: 1.12. or 01.12.
    const structuredPattern = /(\d{1,2}\.\d{1,2}\.)[\s\n]*(?:,|[\s\n]+)[\s\n]*(\d{1,2}:\d{2})[\s\n]*(?:,|[\s\n]+)[\s\n]*(\d{1,2}:\d{2})(?:[\s\n]*(?:,|[\s\n]+)[\s\n]*break[\s\n]*:?[\s\n]*(\d+))?(?:[\s\n]*(?:,|[\s\n]+)[\s\n]*reg[^\d]*((?:\d{1,2}:\d{2})|(\d+)(?:\s*(?:hr|hrs))?))?(?:[\s\n]*(?:,|[\s\n]+)[\s\n]*([\s\S]+))?/i;
    const structuredMatch = message.match(structuredPattern);
    
    if (structuredMatch) {
        log(`  extractWorkInfo: Structured format matched!`);
        log(`    Groups: date=${structuredMatch[1]}, start=${structuredMatch[2]}, end=${structuredMatch[3]}, break=${structuredMatch[4]}, regie=${structuredMatch[5]}`);
        
        // Store the full structured match for highlighting
        const matchStartIndex = structuredMatch.index;
        // structuredMatch[0] includes everything, but we only want to highlight the structured pattern
        // not the description. Group 7 is the description (group 6 is nested regie digits)
        let fullMatch = structuredMatch[0];
        const description = structuredMatch[7]; // Description is group 7
        
        if (description) {
            // Find where description starts in the original message (not in fullMatch)
            // This is more reliable than searching in fullMatch
            const descStartInMessage = message.indexOf(description, matchStartIndex);
            if (descStartInMessage > matchStartIndex) {
                // Extract only the structured pattern part (before description)
                fullMatch = message.substring(matchStartIndex, descStartInMessage).trimEnd();
                // Remove trailing comma if present
                if (fullMatch.endsWith(',')) {
                    fullMatch = fullMatch.slice(0, -1).trimEnd();
                }
            }
        }
        
        // Fill entry with structured format data
        const rawDate = structuredMatch[1].replace(/\.$/, ''); // Remove trailing dot
        entry.workDate = formatDateToDDMMYYYY(rawDate); // Normalize date format
        const rawStart = structuredMatch[2];
        const rawEnd = structuredMatch[3];
        entry.startTime = normalizeTime(rawStart); // Normalize to HH:MM
        entry.endTime = normalizeTime(rawEnd); // Normalize to HH:MM
        log(`    Raw times: start="${rawStart}", end="${rawEnd}"`);
        log(`    Normalized times: start="${entry.startTime}", end="${entry.endTime}"`);
        
        // Don't store timeRangeOriginalText or breakOriginalText for structured format
        // The entire fullMatch will be highlighted as one block
        // Clear any existing values to prevent individual highlighting
        entry.timeRangeOriginalText = '';
        entry.breakOriginalText = '';
        
        if (structuredMatch[4]) {
            entry.breakTime = minutesToHHMM(parseInt(structuredMatch[4]));
            log(`    Extracted break: ${entry.breakTime}`);
        }
        if (structuredMatch[5]) {
            // Handle time format (0:10, 1:15), hours (1 hr, 2 hrs), and minutes (10, 15, 30, 45, 90)
            const regieValue = structuredMatch[5];
            const regieDigits = structuredMatch[6]; // Captured digits if not time format
            let regieMinutes;
            
            if (regieValue.includes(':')) {
                // Time format: "0:10", "1:15" = already in hours:minutes format
                regieMinutes = parseTimeToMinutes(regieValue);
                log(`    Regie time format detected: "${regieValue}" = ${regieMinutes} minutes`);
            } else if (regieDigits) {
                // Check if "hr" or "hrs" appears in the full value (after the digits)
                const hasHr = /\b(?:hr|hrs)\b/i.test(regieValue);
                const numericValue = parseInt(regieDigits);
                
                // Common minute values: 10, 15, 30, 45, 90
                const commonMinutes = [10, 15, 30, 45, 90];
                
                if (hasHr) {
                    // Explicitly marked as hours: "1 hr", "2 hrs"
                    regieMinutes = numericValue * 60;
                    log(`    Regie hours detected: "${regieValue}" = ${numericValue} hours = ${regieMinutes} minutes`);
                } else if (commonMinutes.includes(numericValue)) {
                    // Common minute values without "hr/hrs" = minutes
                    regieMinutes = numericValue;
                    log(`    Regie minutes detected: "${regieValue}" = ${regieMinutes} minutes`);
                } else {
                    // Other values without "hr/hrs" = assume hours (1, 2, 3, etc.)
                    regieMinutes = numericValue * 60;
                    log(`    Regie assumed hours: "${regieValue}" = ${numericValue} hours = ${regieMinutes} minutes`);
                }
            } else {
                // Fallback: treat as minutes
                regieMinutes = parseInt(regieValue);
                log(`    Regie fallback (minutes): "${regieValue}" = ${regieMinutes} minutes`);
            }
            
            entry.regieTime = minutesToHHMM(regieMinutes);
            // Don't store regieOriginalText for structured format - fullMatch will be highlighted
            entry.regieOriginalText = '';
            log(`    Extracted regie: ${entry.regieTime} (from "${regieValue}")`);
        }
        
        entry.nettoTime = calculateNettoTime(entry.startTime, entry.endTime, entry.breakTime, ''); // Netto doesn't subtract regie
        log(`    Calculated netto: ${entry.nettoTime}`);
        
        // Store structured format match info for highlighting the entire pattern
        // Log the fullMatch to verify it's capturing everything including the date
        log(`    Full match captured: "${fullMatch}" (length: ${fullMatch.length}, index: ${matchStartIndex})`);
        entry.structuredFormatMatch = {
            fullText: fullMatch,
            index: matchStartIndex
        };
        
        // Structured format matched - return early, no need for fallback
        return [entry];
    } else {
        log(`  extractWorkInfo: Structured format NOT matched`);
    }
    
    // FALLBACK: Extract from message body if structured format didn't provide all fields
    const dateMatches = findDateMatches(message);
    
    log(`  extractWorkInfo: Found ${dateMatches.length} date matches`);
    if (dateMatches.length > 0) {
        const dateInfo = dateMatches[0];
        log(`  extractWorkInfo: First date="${dateInfo.date}" at index=${dateInfo.index}`);
        
        const cleanEntryText = message.substring(dateInfo.index);
        log(`  extractWorkInfo: Text from date onwards="${cleanEntryText.substring(0, 100).replace(/\n/g, '\\n')}..."`);
        
        // Find additional dates after first date
        const firstDateEndIndex = dateInfo.index + dateInfo.date.length;
        const remainingText = message.substring(firstDateEndIndex);
        DATE_PATTERN_ALL.lastIndex = 0;
        const additionalDates = [];
        let additionalMatch;
        while ((additionalMatch = DATE_PATTERN_ALL.exec(remainingText)) !== null) {
            const additionalDateStr = additionalMatch[1].replace(/\.$/, '');
            if (additionalDateStr !== dateInfo.date) {
                additionalDates.push({
                    date: additionalDateStr,
                    index: firstDateEndIndex + additionalMatch.index,
                    fullMatch: additionalMatch[0]
                });
            }
        }
        if (additionalDates.length > 0) {
            entry.additionalDates = additionalDates;
        }
        
        // Fill empty fields only
        if (!entry.workDate) {
            entry.workDate = formatDateToDDMMYYYY(dateInfo.date); // Normalize date format
            // Store original date match for highlighting
            // Find the full match text at the date index (allow single or double digits)
            const dateMatchAtPos = message.substring(dateInfo.index).match(/^\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\.?/);
            if (dateMatchAtPos) {
                entry.dateOriginalText = dateMatchAtPos[0];
                entry.dateMatchIndex = dateInfo.index;
            }
        }
        
        // Extract times if not already set
        if (!entry.startTime || !entry.endTime) {
            const timeData = extractTimesFromText(cleanEntryText);
            if (timeData.startTime && !entry.startTime) entry.startTime = timeData.startTime;
            if (timeData.endTime && !entry.endTime) entry.endTime = timeData.endTime;
            if (timeData.timeRangeText) entry.timeRangeOriginalText = timeData.timeRangeText;
        }
        
        // Extract break, regie, and calculate netto
        extractTimeDetails(cleanEntryText, entry);
    } else if (!entry.startTime && !entry.endTime && !entry.workDate) {
        // No date found, try extracting times from whole message
        const timeData = extractTimesFromText(message);
        if (timeData.startTime) entry.startTime = timeData.startTime;
        if (timeData.endTime) entry.endTime = timeData.endTime;
        if (timeData.timeRangeText) entry.timeRangeOriginalText = timeData.timeRangeText;
        
        extractTimeDetails(message, entry);
    }
    
    return [entry];
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
    
    // First, find all potential message headers (just the date/time part)
    // This finds ALL lines that start with a date pattern, regardless of what follows
    // Use multiline flag (m) so ^ matches start of each line, not just start of string
    const allHeadersPattern = /^(\d{2}\.\d{2}\.\d{2,4}),\s*(\d{2}:\d{2})\s*-\s*/gm;
    
    const allHeaders = [];
    let headerMatch;
    // Reset regex lastIndex to ensure we start from beginning
    allHeadersPattern.lastIndex = 0;
    while ((headerMatch = allHeadersPattern.exec(content)) !== null) {
        allHeaders.push({
            index: headerMatch.index,
            dateStr: headerMatch[1],
            timeStr: headerMatch[2],
            fullMatch: headerMatch[0]
        });
    }
    
    log(`Found ${allHeaders.length} potential message headers`);
    
    // First, explicitly filter out status messages (no colon after dash) and deleted messages
    // Status messages: "dd.mm.yy, hh:mm - Text" (NO colon after dash)
    // Regular messages: "dd.mm.yy, hh:mm - Name: Text" (HAS colon after sender name)
    // Deleted messages: "dd.mm.yy, hh:mm - Name: Diese Nachricht wurde gelöscht." (has colon but message is deleted)
    const regularMessageHeaders = [];
    const statusMessageIndices = new Set(); // Track status message indices to stop extraction at them
    // Match exact German deleted message texts: "Du hast diese Nachricht gelöscht." or "Diese Nachricht wurde gelöscht."
    const deletedMessagePattern = /^\s*(du\s+hast\s+diese\s+nachricht\s+gelöscht\.|diese\s+nachricht\s+wurde\s+gelöscht\.)\s*$/i;
    
    for (let i = 0; i < allHeaders.length; i++) {
        const header = allHeaders[i];
        const nextHeaderIndex = i < allHeaders.length - 1 ? allHeaders[i + 1].index : content.length;
        const messageStart = header.index;
        const messageText = content.substring(messageStart, Math.min(messageStart + 500, nextHeaderIndex));
        
        // Find the dash after time
        const dashIndex = messageText.indexOf(' - ');
        if (dashIndex >= 0) {
            const afterDash = messageText.substring(dashIndex + 3);
            const firstLineEnd = afterDash.indexOf('\n');
            const firstLine = firstLineEnd > 0 ? afterDash.substring(0, firstLineEnd) : afterDash.substring(0, 200);
            
            // Check if there's a colon in the first line after the dash
            // If yes, it's a regular message. If no, it's a status message.
            if (firstLine.includes(':')) {
                // Check if it's a deleted message (has colon but message content is "deleted")
                // Extract sender and message part: "Name: Message"
                const colonIndex = firstLine.indexOf(':');
                if (colonIndex > 0) {
                    const messageContent = firstLine.substring(colonIndex + 1).trim();
                    if (deletedMessagePattern.test(messageContent)) {
                        deletedMessagesSkipped++;
                        statusMessageIndices.add(header.index);
                        // Deleted message - silently skip (already counted)
                        continue;
                    }
                }
                regularMessageHeaders.push(header);
            } else {
                statusMessagesSkipped++;
                statusMessageIndices.add(header.index);
                // Status message - silently skip (already counted)
            }
        }
    }
    
    log(`Filtered: ${regularMessageHeaders.length} valid messages (${statusMessagesSkipped} status, ${deletedMessagesSkipped} deleted skipped)`);
    const matchedIndices = new Set(); // Track which headers were processed
    const headerPattern = /^(\d{2}\.\d{2}\.\d{2,4}),\s*(\d{2}:\d{2})\s*-\s*([^:\n]+):\s*(.*)/s;
    
    for (let i = 0; i < regularMessageHeaders.length; i++) {
        const header = regularMessageHeaders[i];
        
        // Find the next regular message header
        let nextRegularHeaderIndex = content.length;
        if (i < regularMessageHeaders.length - 1) {
            nextRegularHeaderIndex = regularMessageHeaders[i + 1].index;
        }
        
        // Find the next status message header between this and next regular message
        let nextStatusHeaderIndex = content.length;
        for (const statusIdx of statusMessageIndices) {
            if (statusIdx > header.index && statusIdx < nextRegularHeaderIndex) {
                nextStatusHeaderIndex = Math.min(nextStatusHeaderIndex, statusIdx);
            }
        }
        
        // Stop at whichever comes first: next regular message or next status message
        const nextHeaderIndex = Math.min(nextRegularHeaderIndex, nextStatusHeaderIndex);
        
        // Extract the message block from this header to the next header (regular or status)
        const messageBlock = content.substring(header.index, nextHeaderIndex);
        
        // Parse the header part: "dd.mm.yy, hh:mm - Name: Message"
        const headerMatch = messageBlock.match(headerPattern);
        
        if (!headerMatch) {
            log(`  ⚠ Could not parse header at index ${header.index}`);
            continue;
        }
        
        matchedIndices.add(header.index);
        const [, dateStr, timeStr, sender, message] = headerMatch;
        
        // Deleted messages are already filtered out in the early stage above
        
        // Process message silently (only log errors)
        
        try {
            const messageEntry = processMessage(message, dateStr, timeStr, sender, log);
            if (messageEntry) {
                messages.push(messageEntry);
            }
        } catch (e) {
            log(`  ✗ Error parsing message: ${e.message}`);
            continue;
        }
    }
    
    if (matchedIndices.size < regularMessageHeaders.length) {
        const unmatchedCount = regularMessageHeaders.length - matchedIndices.size;
        log(`⚠ ${unmatchedCount} headers could not be parsed`);
    }
    
    // If primary pattern didn't work, try line-by-line parsing
    if (messages.length === 0) {
        log('Primary pattern found no messages, trying line-by-line parsing...');
        const lines = content.split('\n');
        let currentMessage = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Try the exact format: dd.mm.yy, hh:mm - Name: Message or dd.mm.yyyy, hh:mm - Name: Message
            // IMPORTANT: Must have colon after sender name (filters out WhatsApp status messages)
            let msgMatch = line.match(/^(\d{2}\.\d{2}\.\d{2,4}),\s*(\d{2}:\d{2})\s*-\s*([^:]+):\s*(.+)$/);
            
            if (msgMatch) {
                // Double-check: Skip if this is a status message (no colon in the line after the dash)
                // Status messages have format: "dd.mm.yy, hh:mm - Message" (no colon)
                // Regular messages have format: "dd.mm.yy, hh:mm - Name: Message" (has colon)
                const lineAfterDash = line.substring(line.indexOf(' - ') + 3);
                if (!lineAfterDash.includes(':')) {
                    // This is a status message, skip it
                    // Status message - skip silently
                    continue;
                }
                
                // Save previous message if exists
                if (currentMessage) {
                    messages.push(currentMessage);
                }
                // Start new message
                const [, dateStr, timeStr, sender, message] = msgMatch;
                
                // Filter out deleted messages immediately - match exact German deleted message texts
                const deletedMessagePattern = /^\s*(du\s+hast\s+diese\s+nachricht\s+gelöscht\.|diese\s+nachricht\s+wurde\s+gelöscht\.)\s*$/i;
                if (deletedMessagePattern.test(message.trim())) {
                    deletedMessagesSkipped++;
                    // Deleted message - skip silently
                    currentMessage = null;
                    continue;
                }
                
                try {
                    const [day, month, yearStr] = dateStr.split('.');
                    const year = yearStr.length === 2 ? '20' + yearStr : yearStr;
                    const fullTime = timeStr + ':00';
                    const date = new Date(`${year}-${month}-${day}T${fullTime}`);
                    
                    if (!isNaN(date.getTime())) {
                        // Extract work information from message (use first entry only)
                        const workEntries = extractWorkInfo(message.trim());
                        const workInfo = workEntries.length > 0 ? workEntries[0] : createEmptyEntry();
                        currentMessage = createMessageEntry(dateStr, timeStr, sender, message, workInfo, date);
                    } else {
                        currentMessage = null;
                    }
                } catch (e) {
                    currentMessage = null;
                }
            } else if (currentMessage && line.trim() && !line.match(/^\d{2}\.\d{2}\.\d{2,4},/)) {
                // Continuation of previous message (not a new date line)
                currentMessage.message += '\n' + line.trim();
                // Re-extract work info from full message (in case regie/break info is in continuation lines)
                const fullWorkEntries = extractWorkInfo(currentMessage.message);
                if (fullWorkEntries.length > 0) {
                    updateWorkInfoFromEntry(currentMessage, fullWorkEntries[0]);
                }
            }
        }
        
        // Add last message
        if (currentMessage) {
            // Final extraction from full message to catch any missed info
            const finalWorkEntries = extractWorkInfo(currentMessage.message);
            if (finalWorkEntries.length > 0) {
                updateWorkInfoFromEntry(currentMessage, finalWorkEntries[0]);
            }
            messages.push(currentMessage);
        }
        
        log(`Line-by-line parsing found ${messages.length} messages`);
    }
    
    const nonStatusMessages = messages.length;
    
    log(`\n=== Parsing Summary ===`);
    log(`Total: ${allHeaders.length} headers → ${nonStatusMessages} valid messages (${statusMessagesSkipped} status, ${deletedMessagesSkipped} deleted filtered out)`);
    
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
                totalRegieMinutes: 0
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
        
        // Sum all regie hours
        if (msg.regieTime) {
            const [regieHours, regieMinutes] = msg.regieTime.split(':').map(Number);
            workerData[worker].totalRegieMinutes += regieHours * 60 + regieMinutes;
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
        
        const regieHours = Math.floor(data.totalRegieMinutes / 60);
        const regieMins = data.totalRegieMinutes % 60;
        const regieFormatted = `${String(regieHours).padStart(2, '0')}:${String(regieMins).padStart(2, '0')}`;
        
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
                            <td><strong>Regie Hours (Total)</strong></td>
                            <td style="text-align: right;">${regieFormatted}</td>
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
            const breakTime = getCellValue('breakTime');
            const regieTime = getCellValue('regieTime');
            
            // Always update these fields (even if empty, to allow clearing)
            // Only use dates from message body, never fallback to header date
            originalMsg.workDate = workDate || originalMsg.workDate || '';
            originalMsg.startTime = startTime || '';
            originalMsg.endTime = endTime || '';
            originalMsg.breakTime = breakTime || '';
            originalMsg.regieTime = regieTime || '';
            
            // Recalculate netto
            const nettoTime = calculateNettoTime(startTime, endTime, breakTime, '');
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

// Export to CSV function - reads from DOM to include edited values
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
    
    // CSV header
    const headers = [
        'Msg Date',
        'Date',
        'Start',
        'End',
        'Break',
        'Netto',
        'Regie-hrs',
        'Worker',
        'Log-Text'
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
            getCellValue('date'),
            getCellValue('startTime'),
            getCellValue('endTime'),
            getCellValue('breakTime'),
            getCellValue('nettoTime'),
            getCellValue('regieTime'),
            getCellValue('sender'),
            messageText
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
    
    // Group messages by original message to highlight properly
    const messageGroups = {};
    messages.forEach(msg => {
        const key = `${msg.date}_${msg.time}_${msg.sender}_${msg.message}`;
        if (!messageGroups[key]) {
            messageGroups[key] = {
                msg: msg,
                entries: []
            };
        }
        messageGroups[key].entries.push({
            workDate: msg.workDate,
            startTime: msg.startTime,
            endTime: msg.endTime,
            timeRangeOriginalText: msg.timeRangeOriginalText || '',
            breakTime: msg.breakTime,
            breakOriginalText: msg.breakOriginalText || '',
            regieTime: msg.regieTime,
            regieOriginalText: msg.regieOriginalText || '',
            additionalDates: msg.additionalDates || [],
            structuredFormatMatch: msg.structuredFormatMatch || null,
            dateOriginalText: msg.dateOriginalText || null,
            dateMatchIndex: msg.dateMatchIndex !== undefined ? msg.dateMatchIndex : null
        });
    });
    
    // Track seen work date + person combinations to identify duplicates
    const seenDatePersonCombos = new Set();
    
    const tableRows = messages.map((msg, index) => {
        // Find entries for this message
        const key = `${msg.date}_${msg.time}_${msg.sender}_${msg.message}`;
        const group = messageGroups[key];
        // Only highlight if we have actual extracted values (not all empty)
        const hasExtractedData = group && group.entries.some(entry => 
            entry.workDate || entry.startTime || entry.endTime || entry.breakTime || entry.regieTime
        );
        const highlightedMessage = hasExtractedData ? highlightMessage(msg.message, group.entries) : msg.message;
        
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
        
        // Create unique key for matching: date_time_sender_message
        const uniqueKey = `${msg.date}_${msg.time}_${msg.sender}_${msg.message}`;
        
        // If duplicate date, show empty fields and mark date red
        const dateCellStyle = isDuplicateDate ? ' style="color: #cc0000; font-weight: 600;"' : '';
        const dateCellContent = isDuplicateDate ? `<span style="color: #cc0000;">${dateValue}</span>` : dateValue;
        
        return `
        <tr${isUnmatched ? ' style="background-color: #fff3cd;"' : ''} data-row-index="${index}" data-msg-key="${uniqueKey.replace(/"/g, '&quot;')}">
            <td class="col-msg-date" data-field="msgDate">${msgDateValue}</td>
            <td class="col-date" data-field="date"${dateCellStyle}>${dateCellContent}</td>
            <td class="col-name" data-field="sender">${msg.sender || 'Unknown'}</td>
            <td class="col-start-time editable-number" contenteditable="true" data-field="startTime">${isDuplicateDate ? '' : formatCellValue(msg.startTime)}</td>
            <td class="col-end-time editable-number" contenteditable="true" data-field="endTime">${isDuplicateDate ? '' : formatCellValue(msg.endTime)}</td>
            <td class="col-break editable-number" contenteditable="true" data-field="breakTime">${isDuplicateDate ? '' : formatCellValue(msg.breakTime)}</td>
            <td class="col-netto" data-field="nettoTime">${isDuplicateDate ? '' : formatCellValue(msg.nettoTime)}</td>
            <td class="col-regie editable-number" contenteditable="true" data-field="regieTime">${isDuplicateDate ? '' : formatCellValue(msg.regieTime)}</td>
            <td class="col-message">${highlightedMessage.replace(/\n/g, '<br>')}</td>
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
            
            if (['startTime', 'endTime', 'breakTime', 'regieTime'].includes(field)) {
                if (updatedValue && !validateTimeFormat(updatedValue)) {
                    isValid = false;
                    errorMessage = 'Invalid time format. Please use HH:MM (e.g., 08:30)';
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
                    
                    // Validate: break < (end time - start time) duration
                    if (startTime && endTime) {
                        const startMinutes = parseTimeToMinutes(startTime);
                        const endMinutes = parseTimeToMinutes(endTime);
                        const breakMinutes = parseTimeToMinutes(breakTime) || 0;
                        
                        if (startMinutes && endMinutes) {
                            let totalMinutes = endMinutes - startMinutes;
                            if (totalMinutes < 0) {
                                totalMinutes += 24 * 60; // Overnight shift
                            }
                            
                            // Break time must be less than the total duration (end - start)
                            if (breakMinutes >= totalMinutes) {
                                const totalDuration = minutesToHHMM(totalMinutes);
                                alert(`Invalid break time: Break time (${breakTime || '00:00'}) must be less than the work duration (${totalDuration}).\nStart: ${startTime}, End: ${endTime}, Duration: ${totalDuration}`);
                                this.textContent = '';
                                this.focus();
                                return;
                            }
                        }
                    }
                    
                    const netto = calculateNettoTime(startTime, endTime, breakTime, '');
                    nettoCell.textContent = netto || '';
                    
                    // Update row formatting based on whether both start and end times are present
                    const isUnmatched = !startTime || !endTime;
                    if (isUnmatched) {
                        row.style.backgroundColor = '#fff3cd';
                    } else {
                        row.style.backgroundColor = '';
                    }
                }
            }
            
            // Validate regie-hrs <= netto if regie changed
            if (field === 'regieTime') {
                const nettoCell = row.querySelector('[data-field="nettoTime"]');
                const nettoTime = nettoCell ? (nettoCell.textContent || '').trim().replace(/N\/A/gi, '').replace(/<[^>]*>/g, '') : '';
                
                if (updatedValue && nettoTime && !validateRegieVsNetto(updatedValue, nettoTime)) {
                    alert(`Regie hours (${updatedValue}) cannot exceed netto time (${nettoTime})`);
                    this.textContent = '';
                    this.focus();
                    return;
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


