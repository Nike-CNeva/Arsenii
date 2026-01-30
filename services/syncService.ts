import { 
  BabyEvent, 
  EventType, 
  SleepType, 
  FeedingType, 
  DiaperType, 
  HealthSubtype, 
  GrowthEvent,
  FeedingEvent,
  SleepEvent,
  DiaperEvent,
  PumpingEvent,
  HealthEvent,
  MoodEvent,
  MilestoneEvent,
  WalkEvent,
  BathEvent
} from '../types';
import { EVENT_CONFIG } from '../constants';

// --- Mappers ---

interface DBRow {
  event_datetime: string;
  event_name: string;
  event_type: string;
  value_text: string | null;
  value_numeric: number | null;
  start_datetime: string;
  end_datetime: string | null;
  comment: string | null;
}

const mapEventToRows = (e: BabyEvent): DBRow[] => {
  const rows: DBRow[] = [];
  
  const base = {
    event_datetime: e.timestamp,
    start_datetime: e.timestamp,
    end_datetime: (e as any).endTime || null,
    comment: e.note || null,
    event_type: e.type,
  };

  const createRow = (name: string, valText: string | null, valNum: number | null): DBRow => ({
    ...base,
    event_name: name,
    value_text: valText,
    value_numeric: valNum
  });

  switch(e.type) {
    case EventType.GROWTH:
        const g = e as GrowthEvent;
        if (g.weightKg) rows.push(createRow('Вес', null, g.weightKg));
        if (g.heightCm) rows.push(createRow('Рост', null, g.heightCm));
        if (g.headCircumferenceCm) rows.push(createRow('Окружность головы', null, g.headCircumferenceCm));
        break;
        
    case EventType.FEEDING:
            const f = e as FeedingEvent;
            const fDetails = [];
            if (f.feedingType) fDetails.push(f.feedingType === 'BREAST' ? 'Грудь' : f.feedingType === 'BOTTLE' ? 'Бутылка' : 'Прикорм');
            if (f.side) fDetails.push(f.side === 'Left' ? 'Левая' : f.side === 'Right' ? 'Правая' : 'Обе');
            
            const fName = f.feedingType === 'BREAST' ? 'ГВ' : f.feedingType === 'BOTTLE' ? 'Смесь' : 'Еда';
            rows.push(createRow(fName, fDetails.join(', '), f.amountMl || null));
            break;
            
    case EventType.SLEEP:
            const s = e as SleepEvent;
            const sName = s.subtype === SleepType.NIGHT ? 'Ночной сон' : 'Дневной сон';
            rows.push(createRow(sName, s.subtype || null, null));
            break;
            
    case EventType.DIAPER:
            const d = e as DiaperEvent;
            let dStatus = 'Смешанный';
            if (d.status === DiaperType.WET) dStatus = 'Мокрый';
            if (d.status === DiaperType.DIRTY) dStatus = 'Грязный';
            rows.push(createRow('Подгузник', dStatus, null));
            break;

    case EventType.PUMPING:
            const p = e as PumpingEvent;
            const pSide = p.side === 'Left' ? 'Левая' : p.side === 'Right' ? 'Правая' : 'Обе';
            rows.push(createRow('Сцеживание', pSide, p.amountMl));
            break;

    case EventType.HEALTH:
            const h = e as HealthEvent;
            const hText = [h.subtype, h.value].filter(Boolean).join(': ');
            rows.push(createRow('Здоровье', hText, h.temperature || null));
            break;
            
    case EventType.WALK:
            rows.push(createRow('Прогулка', null, null));
            break;
            
    case EventType.BATH:
            rows.push(createRow('Купание', null, null));
            break;

    case EventType.MOOD:
            rows.push(createRow('Настроение', (e as MoodEvent).mood, null));
            break;

    case EventType.MILESTONE:
            rows.push(createRow('Достижение', (e as MilestoneEvent).title || null, null));
            break;

    default:
            rows.push(createRow(EVENT_CONFIG[(e as any).type]?.label || 'Событие', null, null));
  }

  return rows;
};

const mapRowToEvent = (row: any): BabyEvent => {
    const id = `db-${new Date(row.event_datetime).getTime()}-${row.id}`;
    const base = {
        id,
        timestamp: row.event_datetime,
        note: row.comment || undefined,
        type: (row.event_type as EventType) || EventType.MILESTONE 
    };

    const durationProps = {
        endTime: row.end_datetime || undefined
    };

    if (row.event_type === EventType.SLEEP) {
        return {
            ...base,
            type: EventType.SLEEP,
            subtype: row.value_text?.includes('NIGHT') || row.event_name.includes('Ноч') ? SleepType.NIGHT : SleepType.DAY,
            ...durationProps
        } as SleepEvent;
    }

    if (row.event_type === EventType.FEEDING) {
        let feedingType = FeedingType.BOTTLE;
        if (row.event_name === 'ГВ' || row.value_text?.includes('Грудь')) feedingType = FeedingType.BREAST;
        if (row.event_name === 'Еда' || row.value_text?.includes('Прикорм')) feedingType = FeedingType.SOLIDS;
        
        return {
            ...base,
            type: EventType.FEEDING,
            feedingType,
            amountMl: row.value_numeric || undefined,
            side: row.value_text?.includes('Левая') ? 'Left' : row.value_text?.includes('Правая') ? 'Right' : undefined,
            ...durationProps
        } as FeedingEvent;
    }

    if (row.event_type === EventType.GROWTH) {
        return {
            ...base,
            type: EventType.GROWTH,
            weightKg: row.event_name === 'Вес' ? row.value_numeric : undefined,
            heightCm: row.event_name === 'Рост' ? row.value_numeric : undefined,
            headCircumferenceCm: row.event_name === 'Окружность головы' ? row.value_numeric : undefined,
        } as GrowthEvent;
    }

    if (row.event_type === EventType.DIAPER) {
        let status = DiaperType.MIXED;
        if (row.value_text?.includes('Мокр')) status = DiaperType.WET;
        if (row.value_text?.includes('Гряз')) status = DiaperType.DIRTY;
        return { ...base, type: EventType.DIAPER, status } as DiaperEvent;
    }

    if (row.event_type === EventType.WALK) return { ...base, type: EventType.WALK, ...durationProps } as WalkEvent;
    if (row.event_type === EventType.BATH) return { ...base, type: EventType.BATH, ...durationProps } as BathEvent;
    
    if (row.event_type === EventType.MOOD) {
        return { ...base, type: EventType.MOOD, mood: row.value_text || 'Normal' } as MoodEvent;
    }

    if (row.event_type === EventType.MILESTONE) {
        return { ...base, type: EventType.MILESTONE, title: row.value_text || row.event_name } as MilestoneEvent;
    }
    
    if (row.event_type === EventType.PUMPING) {
        return { 
            ...base, 
            type: EventType.PUMPING, 
            amountMl: row.value_numeric || 0,
            side: row.value_text?.includes('Левая') ? 'Left' : row.value_text?.includes('Правая') ? 'Right' : undefined
        } as PumpingEvent;
    }

    if (row.event_type === EventType.HEALTH) {
        return {
            ...base,
            type: EventType.HEALTH,
            subtype: HealthSubtype.OTHER,
            value: row.value_text || '',
            temperature: row.value_numeric || undefined
        } as HealthEvent;
    }

    return { ...base, type: EventType.MILESTONE, title: row.event_name } as MilestoneEvent;
};

// --- API Methods ---

const getHeaders = (token?: string) => {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };
    if (token && token.trim() !== '') {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const checkConnection = async (url: string, token?: string): Promise<boolean> => {
    try {
        const res = await fetch(url, { 
            method: 'HEAD',
            headers: getHeaders(token)
        });
        return res.ok || res.status === 405; 
    } catch {
        return false;
    }
};

export const pushEventsToRemote = async (url: string, events: BabyEvent[], token?: string) => {
    let allRows: DBRow[] = [];
    events.forEach(e => {
        allRows = allRows.concat(mapEventToRows(e));
    });

    if (allRows.length === 0) return { success: true, count: 0 };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(token),
            body: JSON.stringify(allRows)
        });

        if (!response.ok) {
            let errorText = '';
            try { errorText = await response.text(); } catch {}
            throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        
        return { success: true, count: allRows.length };
    } catch (e: any) {
        console.error("Sync Error", e);
        // Better error message for common issues
        let msg = e.message;
        if (msg.includes('Failed to fetch')) msg = 'Ошибка сети (CORS или сервер недоступен)';
        return { success: false, error: msg };
    }
};

export const fetchEventsFromRemote = async (url: string, token?: string) => {
    try {
        const headers = getHeaders(token);
        headers['Accept'] = 'application/json';
        
        const response = await fetch(`${url}?select=*&order=event_datetime.desc`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
             let errorText = '';
             try { errorText = await response.text(); } catch {}
             throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        const rows = await response.json();
        const events = rows.map(mapRowToEvent);
        return { success: true, events };
    } catch (e: any) {
        console.error("Fetch Error", e);
        let msg = e.message;
        if (msg.includes('Failed to fetch')) msg = 'Ошибка сети (CORS или сервер недоступен)';
        return { success: false, error: msg };
    }
};
