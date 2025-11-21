# WhatsApp Chat Parser

Tool for parsing WhatsApp chat exports and extracting work hours.

## Usage

1. Open `index.html` in your browser
2. Select a ZIP file with WhatsApp chat export (.txt files)
3. Click "Parse chat export"

**No installation required!** Works directly in the browser, offline after first load.

## Supported Formats

- **Text Format** (.txt): WhatsApp text export
- **HTML Format** (.html): WhatsApp HTML export  
- **JSON Format** (.json): WhatsApp JSON export

## Output

- **Statistics**: Messages, senders, date range, regie hours per person
- **Work Log Table**: All extracted work entries
- **CSV Export**: Export data

---

# Pattern Matching

**All patterns are whitespace-insensitive** - match with any amount/type of whitespace or none.

## Output Fields

| Field | Description |
|-------|-------------|
| **Date** | Work date (dd.mm, dd.mm., dd.mm.yy, or dd.mm.yyyy). Falls back to message date if not found |
| **Start/End** | Work times (HH:MM format) |
| **Break** | Break duration (HH:MM format) |
| **Netto** | Calculated: End - Start - Break - Regie-hrs |
| **Regie-hrs** | Regie hours (HH:MM format, summed if multiple) |
| **Regie-type** | Type of regie work (comma-separated if multiple) |
| **Worker** | Sender name |
| **Log-Text** | Full message text |

## Pattern Examples

| Pattern | Example |
|---------|---------|
| **Structured** | `18.11., 08:00, 14:00, break: 30, regie: 90, regie-type: wood` (or `regie-hrs: 90`) |
| **Date** | `19.11-`, `19.11 /`, `20.11 14:00`, `18.11` (dd.mm, dd.mm., dd.mm.yy, dd.mm.yyyy) |
| **Time Range** | `08:00-17:00`, `08:00 17:00` |
| **Break** | `1h lunch`, `45 min lunch`, `45' lunch`, `1/2 hr lunch`, `08:00-17:00 45 min` (no keywords needed) |
| **Regie** | `30 min regie`, `1/2 hr regie`, `1hr regie` |
| **Regie Type** | `regie-type: wood` or `30 min regie moving branches` |

## Extraction Rules

**Priority**: Structured format → Date patterns → Time range → Break/Regie patterns

**Break Time**:
- With keywords: `break`, `lunch`, `pause`, `tea`, `rest` (within 20 chars after duration)
- After time range: Duration within 20 chars after `08:00-17:00` (no keywords needed)
- Formats: `1h`, `45 min`, `45'`, `1/2 hr`, `0.75hrs` → converted to HH:MM

**Regie Time**:
- Requires `regie` keyword within 15 chars after duration
- Multiple entries are summed
- Formats: `30 min regie`, `1/2 hr regie`, `1hr regie` → converted to HH:MM

**Regie Type**:
- Structured: `regie-type: wood`
- Context-based: Text after `regie` keyword (e.g., `30 min regie moving branches` → "moving branches")
- Multiple types combined with comma

**Netto Calculation**: `(End - Start) - Break`
