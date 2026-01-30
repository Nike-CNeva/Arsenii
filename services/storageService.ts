import { 
  BabyEvent, 
  EventType, 
  SleepEvent, 
  WalkEvent, 
  FeedingEvent, 
  FeedingType, 
  DiaperEvent, 
  DiaperType, 
  GrowthEvent, 
  HealthEvent,
  BathEvent,
  PumpingEvent,
  MoodEvent,
  MilestoneEvent,
  HealthSubtype,
  SleepType
} from '../types';
import { EVENT_CONFIG } from '../constants';

const STORAGE_KEY = 'arseniy_events_v1';

export const getEvents = (): BabyEvent[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error loading events", error);
    return [];
  }
};

export const saveEvent = (event: BabyEvent): BabyEvent[] => {
  const events = getEvents();
  const newEvents = [event, ...events];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newEvents));
  return newEvents;
};

export const updateEvent = (updatedEvent: BabyEvent): BabyEvent[] => {
  const events = getEvents();
  const newEvents = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newEvents));
  return newEvents;
};

export const deleteEvent = (id: string): BabyEvent[] => {
  const events = getEvents();
  const newEvents = events.filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newEvents));
  return newEvents;
};

// Helper to correctly split CSV lines respecting quotes
const splitCSVLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(v => v.trim().replace(/^"|"$/g, ''));
};

const mapSide = (str: string): 'Left' | 'Right' | 'Both' | undefined => {
  const s = str.toLowerCase();
  if (s.includes('лев')) return 'Left';
  if (s.includes('прав')) return 'Right';
  if (s.includes('обе')) return 'Both';
  return undefined;
};

export const parseCSV = (csvText: string): BabyEvent[] => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes(';')) delimiter = ';';
  else if (firstLine.includes('\t')) delimiter = '\t';

  const headers = splitCSVLine(firstLine, delimiter).map(h => h.trim().toLowerCase());
  
  const getIdx = (namePart: string) => headers.findIndex(h => h === namePart || h.includes(namePart));
  
  const colDate = getIdx('дата');
  const colEvent = getIdx('событие');
  const colType = getIdx('тип');
  let colValNum = headers.findIndex(h => h === 'значение.число');
  if (colValNum === -1) colValNum = getIdx('значение.число');
  const colValStr = headers.findIndex(h => h === 'значение'); 
  const colStart = getIdx('начало');
  const colEnd = getIdx('окончание');
  const colNote = getIdx('комментарий');

  const events: BabyEvent[] = [];
  const growthMap: Record<string, GrowthEvent> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delimiter);
    if (cols.length < 2) continue;

    const rawDate = cols[colDate] || '';
    const name = cols[colEvent] || '';
    const typeStr = cols[colType] || '';
    
    let rawVal = '';
    if (colValNum > -1 && cols[colValNum]) rawVal = cols[colValNum];
    else if (colValStr > -1 && cols[colValStr]) rawVal = cols[colValStr];

    const valNumStr = rawVal.replace(/\s/g, '').replace(/[^\d,\.-]/g, '').replace(/,/g, '.');
    const valNum = valNumStr ? parseFloat(valNumStr) : 0;

    const startStr = cols[colStart] || '';
    const endStr = cols[colEnd] || '';
    const note = cols[colNote] || '';

    const timestampStr = startStr && startStr.length > 5 ? startStr : rawDate;
    if (!timestampStr) continue;
    
    let timestamp: string;
    try {
        timestamp = new Date(timestampStr.replace(' ', 'T')).toISOString();
    } catch { continue; }

    const baseId = `csv-${i}-${Date.now()}`;
    const base = { id: baseId, timestamp, note };

    if (name === 'Сон') {
        let subtype = undefined;
        if (typeStr.toLowerCase().includes('ноч')) subtype = SleepType.NIGHT;
        if (typeStr.toLowerCase().includes('днев')) subtype = SleepType.DAY;

        events.push({
            ...base,
            type: EventType.SLEEP,
            subtype,
            endTime: endStr ? new Date(endStr.replace(' ', 'T')).toISOString() : undefined,
        } as SleepEvent);
    } else if (name === 'Прогулка') {
         events.push({
            ...base,
            type: EventType.WALK,
            endTime: endStr ? new Date(endStr.replace(' ', 'T')).toISOString() : undefined,
        } as WalkEvent);
    } else if (name === 'Купание') {
         events.push({
            ...base,
            type: EventType.BATH,
            endTime: endStr ? new Date(endStr.replace(' ', 'T')).toISOString() : undefined,
        } as BathEvent);
    } else if (name === 'Кормление грудью') {
         events.push({
            ...base,
            type: EventType.FEEDING,
            feedingType: FeedingType.BREAST,
            endTime: endStr ? new Date(endStr.replace(' ', 'T')).toISOString() : undefined,
            side: mapSide(typeStr)
        } as FeedingEvent);
    } else if (name === 'Сцеживание') {
         events.push({
            ...base,
            type: EventType.PUMPING,
            amountMl: valNum,
            side: mapSide(typeStr)
        } as PumpingEvent);
    } else if (name === 'Бутылочка') {
         events.push({
            ...base,
            type: EventType.FEEDING,
            feedingType: FeedingType.BOTTLE,
            amountMl: valNum,
            note: [typeStr, note].filter(Boolean).join(' ')
        } as FeedingEvent);
    } else if (name === 'Подгузник') {
        let status = DiaperType.MIXED;
        const ts = typeStr.toLowerCase();
        if (ts.includes('мокр')) status = DiaperType.WET;
        else if (ts.includes('гряз')) status = DiaperType.DIRTY;
        
        events.push({
            ...base,
            type: EventType.DIAPER,
            status,
        } as DiaperEvent);
    } else if (name === 'Настроение') {
        events.push({
            ...base,
            type: EventType.MOOD,
            mood: typeStr || 'Normal'
        } as MoodEvent);
    } else if (name === 'Важное событие') {
        events.push({
            ...base,
            type: EventType.MILESTONE,
            title: note || typeStr
        } as MilestoneEvent);
    } else if (['Вес', 'Рост', 'Окружность головы'].includes(name)) {
        const key = timestamp; 
        if (!growthMap[key]) {
            growthMap[key] = {
                id: `growth-${key}`,
                timestamp,
                type: EventType.GROWTH,
                weightKg: 0,
                heightCm: 0,
                headCircumferenceCm: 0,
                note: ''
            };
        }
        if (name === 'Вес') growthMap[key].weightKg = valNum;
        if (name === 'Рост') growthMap[key].heightCm = valNum;
        if (name === 'Окружность головы') growthMap[key].headCircumferenceCm = valNum;
    } else if (name === 'Визит врача' || name === 'Прививка' || name === 'Болезнь' || name === 'Прием лекарств') {
        let subtype = HealthSubtype.OTHER;
        let value = typeStr;

        if (name === 'Визит врача') {
            subtype = HealthSubtype.DOCTOR;
        } else if (name === 'Прививка') {
            subtype = HealthSubtype.VACCINE;
        } else if (name === 'Болезнь') {
            subtype = HealthSubtype.SICKNESS;
        } else if (name === 'Прием лекарств') {
            subtype = HealthSubtype.MEDICINE;
        }

        events.push({
            ...base,
            type: EventType.HEALTH,
            subtype,
            value,
            note: note // Keep note separate
        } as HealthEvent);
    } else {
        // Fallback
        events.push({
            ...base,
            type: EventType.HEALTH,
            subtype: HealthSubtype.OTHER,
            note: `${name} ${typeStr} ${note}`.trim()
        } as HealthEvent);
    }
  }

  Object.values(growthMap).forEach(g => {
      if (g.weightKg || g.heightCm || g.headCircumferenceCm) {
          events.push(g);
      }
  });

  return events;
};

export const importEvents = (importedData: BabyEvent[]): { success: boolean, count: number, message: string } => {
  try {
    const currentEvents = getEvents();
    const currentIds = new Set(currentEvents.map(e => e.id));
    const uniqueNewEvents = importedData.filter(e => !currentIds.has(e.id));
    
    const currentTimeTypeKeys = new Set(currentEvents.map(e => `${e.timestamp}-${e.type}`));
    const finalEventsToAdd = uniqueNewEvents.filter(e => !currentTimeTypeKeys.has(`${e.timestamp}-${e.type}`));

    if (finalEventsToAdd.length === 0) {
      return { success: true, count: 0, message: "Нет новых данных для импорта (дубликаты обнаружены)." };
    }

    const mergedEvents = [...finalEventsToAdd, ...currentEvents];
    mergedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedEvents));
    return { success: true, count: finalEventsToAdd.length, message: `Успешно импортировано ${finalEventsToAdd.length} записей.` };
  } catch (e) {
    return { success: false, count: 0, message: "Ошибка при чтении файла." };
  }
};

export const exportEvents = (): string => {
  const events = getEvents();
  return JSON.stringify(events, null, 2);
};

export const generatePostgresSQL = (): string => {
  const events = getEvents();
  // Sort Chronologically for insertion (Oldest First)
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let sql = `-- PostgreSQL Dump for nikecneva_db\n`;
  sql += `-- Generated: ${new Date().toLocaleString()}\n`;
  sql += `-- Target Table: baby_events\n\n`;
  sql += `INSERT INTO baby_events (event_datetime, event_name, event_type, value_text, value_numeric, start_datetime, end_datetime, comment)\nVALUES\n`;

  const values: string[] = [];

  const escape = (str?: string) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';
  const num = (n?: number) => n !== undefined && n !== null && !isNaN(n) ? n : 'NULL';
  // Format Date for Postgres: YYYY-MM-DD HH:MM:SS
  const fmtDate = (d: string) => `'${new Date(d).toISOString().replace('T', ' ').replace('Z', '')}'`;

  sorted.forEach(e => {
     // Common Fields
     const eventDt = fmtDate(e.timestamp);
     const eventType = escape(e.type);
     const startDt = fmtDate(e.timestamp);
     const endDt = (e as any).endTime ? fmtDate((e as any).endTime) : 'NULL';
     const comment = escape(e.note);

     // Helper to push a row
     const pushRow = (eventName: string, valText: string, valNum: string | number) => {
        values.push(`(${eventDt}, '${eventName}', ${eventType}, ${valText}, ${valNum}, ${startDt}, ${endDt}, ${comment})`);
     };

     // Mapping Logic
     switch(e.type) {
        case EventType.GROWTH:
            const g = e as GrowthEvent;
            // Split Growth into multiple rows if needed, as the table schema seems to favor singular numeric values
            if (g.weightKg) pushRow('Вес', 'NULL', g.weightKg);
            if (g.heightCm) pushRow('Рост', 'NULL', g.heightCm);
            if (g.headCircumferenceCm) pushRow('Окружность головы', 'NULL', g.headCircumferenceCm);
            break;
            
        case EventType.FEEDING:
             const f = e as FeedingEvent;
             const fDetails = [];
             if (f.feedingType) fDetails.push(f.feedingType === 'BREAST' ? 'Грудь' : f.feedingType === 'BOTTLE' ? 'Бутылка' : 'Прикорм');
             if (f.side) fDetails.push(f.side === 'Left' ? 'Левая' : f.side === 'Right' ? 'Правая' : 'Обе');
             
             // Name depends on type
             const fName = f.feedingType === 'BREAST' ? 'ГВ' : f.feedingType === 'BOTTLE' ? 'Смесь' : 'Еда';
             pushRow(fName, escape(fDetails.join(', ')), num(f.amountMl));
             break;
             
        case EventType.SLEEP:
             const s = e as SleepEvent;
             const sName = s.subtype === SleepType.NIGHT ? 'Ночной сон' : 'Дневной сон';
             pushRow(sName, escape(s.subtype), 'NULL');
             break;
             
        case EventType.DIAPER:
             const d = e as DiaperEvent;
             let dStatus = 'Смешанный';
             if (d.status === DiaperType.WET) dStatus = 'Мокрый';
             if (d.status === DiaperType.DIRTY) dStatus = 'Грязный';
             pushRow('Подгузник', escape(dStatus), 'NULL');
             break;

        case EventType.PUMPING:
             const p = e as PumpingEvent;
             const pSide = p.side === 'Left' ? 'Левая' : p.side === 'Right' ? 'Правая' : 'Обе';
             pushRow('Сцеживание', escape(pSide), num(p.amountMl));
             break;

        case EventType.HEALTH:
             const h = e as HealthEvent;
             const hText = [h.subtype, h.value].filter(Boolean).join(': ');
             pushRow('Здоровье', escape(hText), num(h.temperature));
             break;
             
        case EventType.WALK:
             pushRow('Прогулка', 'NULL', 'NULL');
             break;
             
        case EventType.BATH:
             pushRow('Купание', 'NULL', 'NULL');
             break;

        case EventType.MOOD:
             pushRow('Настроение', escape((e as MoodEvent).mood), 'NULL');
             break;

        case EventType.MILESTONE:
             pushRow('Достижение', escape((e as MilestoneEvent).title), 'NULL');
             break;

        default:
             const type = (e as any).type;
             const label = EVENT_CONFIG[type as EventType]?.label || 'Unknown';
             pushRow(label, 'NULL', 'NULL');
     }
  });

  if (values.length === 0) return "-- No events to export";

  return sql + values.join(',\n') + ';';
};
