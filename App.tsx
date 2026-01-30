import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Clock, 
  Calendar, 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  Trash2,
  Baby,
  Activity,
  ChevronRight,
  List,
  BarChart3,
  Filter,
  MessageCircle,
  Database,
  RefreshCw,
  Server,
  Key
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import { 
  BabyEvent, 
  EventType,
  FeedingType,
  HealthSubtype,
  SleepType
} from './types';
import { ARSENIY_PROFILE, EVENT_CONFIG } from './constants';
import * as db from './services/storageService';
import * as sync from './services/syncService';
import { EventModal } from './components/EventModal';
import { ChatView } from './components/ChatView';

// --- Helper Functions ---

const formatTime = (dateStr: string) => {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
};

const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(dateStr));
};

const formatDateShort = (dateStr: string) => {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(dateStr));
};

const calculateDuration = (start: string, end: string) => {
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime()) / 1000;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m} мин`;
};

const calculateAge = (birthDate: string) => {
  const birth = new Date(birthDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - birth.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (now < birth) {
    return `Ожидается через ${diffDays} дн.`;
  }
  
  if (diffDays < 30) return `${diffDays} дней`;
  const months = Math.floor(diffDays / 30.44);
  const days = Math.floor(diffDays % 30.44);
  return `${months} мес ${days} дн`;
};

// --- Sub-Components ---

const TimelineBar = ({ events, date }: { events: BabyEvent[], date: Date }) => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  
  const msInDay = 24 * 60 * 60 * 1000;

  // Filter events that OVERLAP with this day
  const relevantEvents = events.filter(e => {
    const s = new Date(e.timestamp);
    let end = s;
    
    // Determine end time for duration events
    if ((e as any).endTime) {
        end = new Date((e as any).endTime);
    } else {
        // Assume short duration for point events so they render as bars
        end = new Date(s.getTime() + 10 * 60000); 
    }

    // Check overlap: EventStart < DayEnd AND EventEnd > DayStart
    return s < dayEnd && end > dayStart;
  });

  const durationSegments = relevantEvents.map(e => {
    const s = new Date(e.timestamp);
    // If no endTime, use default 10 mins
    const end = (e as any).endTime ? new Date((e as any).endTime) : new Date(s.getTime() + 10 * 60000);
    
    // Clamp visual bar to this day
    const effectiveStart = s < dayStart ? dayStart : s;
    const effectiveEnd = end > dayEnd ? dayEnd : end;

    if (effectiveEnd <= effectiveStart) return null;

    const left = ((effectiveStart.getTime() - dayStart.getTime()) / msInDay) * 100;
    const width = ((effectiveEnd.getTime() - effectiveStart.getTime()) / msInDay) * 100;
    
    let colorClass = 'bg-gray-300';
    if (e.type === EventType.SLEEP) {
        if ((e as any).subtype === SleepType.NIGHT) colorClass = 'bg-indigo-700'; // Darker for Night
        else colorClass = 'bg-indigo-400'; // Standard for Day
    } else if (e.type === EventType.WALK) colorClass = 'bg-green-400';
    else if (e.type === EventType.BATH) colorClass = 'bg-cyan-400';
    else if (e.type === EventType.FEEDING) colorClass = 'bg-orange-400';
    else if (e.type === EventType.PUMPING) colorClass = 'bg-pink-400';
    else if (e.type === EventType.DIAPER) colorClass = 'bg-teal-400';
    else if (e.type === EventType.HEALTH) colorClass = 'bg-red-400';
    else if (e.type === EventType.GROWTH) colorClass = 'bg-blue-400';
    else if (e.type === EventType.MOOD) colorClass = 'bg-yellow-400';
    else if (e.type === EventType.MILESTONE) colorClass = 'bg-purple-400';

    return { id: e.id, left, width, colorClass, data: e };
  }).filter(Boolean);

  return (
    <div className="relative w-full h-8 bg-gray-100 rounded-lg overflow-hidden mb-2 mt-2">
      {/* Hour markers */}
      {[0, 6, 12, 18].map(h => (
         <div key={h} className="absolute top-0 bottom-0 border-l border-gray-200 z-0" style={{ left: `${(h/24)*100}%` }}>
            <span className="absolute top-0.5 left-0.5 text-[8px] text-gray-400 font-mono">{h}</span>
         </div>
      ))}
      
      {/* Render Bars */}
      {durationSegments.map((seg: any) => (
        <div 
          key={seg.id}
          className={`absolute top-0 bottom-0 z-10 ${seg.colorClass} border-r border-white/20`}
          style={{ left: `${seg.left}%`, width: `${Math.max(seg.width, 0.5)}%` }} // Min width for visibility
        />
      ))}
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [view, setView] = useState<'dashboard' | 'history' | 'stats' | 'chat' | 'settings'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState<EventType>(EventType.FEEDING);
  
  // Sync State
  const [apiUrl, setApiUrl] = useState('https://api.db.nike-cneva.ru/baby_events');
  const [apiToken, setApiToken] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYmFieV91c2VyIiwiaXNzIjoibmlrZS1zZXJ2ZXIiLCJleHAiOjE4OTM0NTYwMDB9.sP_cOTmIz7S5XY2wZEJH2ZMdhxzYKsDxLGjJ6sFQps0');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    refreshEvents();
    const storedUrl = localStorage.getItem('postgrest_url');
    if (storedUrl) setApiUrl(storedUrl);
    
    const storedToken = localStorage.getItem('postgrest_token');
    if (storedToken) setApiToken(storedToken);
  }, []);

  const refreshEvents = () => {
    setEvents(db.getEvents());
  };

  const handleSaveEvent = (event: BabyEvent) => {
    db.saveEvent(event);
    refreshEvents();
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить эту запись?')) {
      db.deleteEvent(id);
      refreshEvents();
    }
  };

  const saveApiUrl = (url: string) => {
      setApiUrl(url);
      localStorage.setItem('postgrest_url', url);
  };

  const saveApiToken = (token: string) => {
      setApiToken(token);
      localStorage.setItem('postgrest_token', token);
  };

  // --- Sync Handlers ---
  const handlePushToCloud = async () => {
      if(!confirm('Это отправит все локальные данные на сервер. Продолжить?')) return;
      setIsSyncing(true);
      const res = await sync.pushEventsToRemote(apiUrl, events, apiToken);
      setIsSyncing(false);
      if (res.success) {
          alert(`Успешно отправлено ${res.count} записей.`);
      } else {
          alert(`❌ Ошибка синхронизации:\n\n${res.error}\n\nПроверьте:\n1. URL сервера (доступен ли он?)\n2. Токен авторизации (введен ли он?)\n3. Настройки CORS на сервере.`);
      }
  };

  const handlePullFromCloud = async () => {
      if(!confirm('Это загрузит данные с сервера и добавит их к текущим (дубликаты будут пропущены). Продолжить?')) return;
      setIsSyncing(true);
      const res = await sync.fetchEventsFromRemote(apiUrl, apiToken);
      setIsSyncing(false);
      if (res.success && res.events) {
          const importRes = db.importEvents(res.events);
          refreshEvents();
          alert(importRes.message);
      } else {
           alert(`❌ Ошибка синхронизации:\n\n${res.error}\n\nПроверьте:\n1. URL сервера (доступен ли он?)\n2. Токен авторизации (введен ли он?)\n3. Настройки CORS на сервере.`);
      }
  };

  // --- Derived Data for Dashboard Stats ---
  
  const getLatestMetric = (type: EventType, key: string, fallback: number) => {
    // Sort descending by date
    const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    // Find first entry where value > 0
    const entry = sorted.find(e => e.type === type && (e as any)[key] > 0);
    return entry ? (entry as any)[key] : fallback;
  };

  const currentWeight = getLatestMetric(EventType.GROWTH, 'weightKg', ARSENIY_PROFILE.birthWeight);
  const currentHeight = getLatestMetric(EventType.GROWTH, 'heightCm', ARSENIY_PROFILE.birthHeight);
  const currentHead = getLatestMetric(EventType.GROWTH, 'headCircumferenceCm', 0) || '-';

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = evt.target?.result as string;
          let importedEvents: BabyEvent[];

          if (file.name.toLowerCase().endsWith('.csv') || content.includes(';')) {
             importedEvents = db.parseCSV(content);
          } else {
             importedEvents = JSON.parse(content);
          }
          
          const result = db.importEvents(importedEvents);
          alert(result.message);
          refreshEvents();
        } catch (err) {
          alert('Ошибка чтения файла. Проверьте формат.');
          console.error(err);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExport = () => {
    const json = db.exportEvents();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arseniy-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleSQLExport = () => {
    const sql = db.generatePostgresSQL();
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baby_events_insert.sql`;
    a.click();
  };

  // --- View Components ---

  const Dashboard = () => {
    return (
      <div className="space-y-6 pb-24 animate-fade-in">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-baby-darkBlue to-baby-accent text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Baby size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-1">{ARSENIY_PROFILE.name}</h1>
                <p className="text-blue-100 opacity-90 text-sm">
                  Родился: {new Date(ARSENIY_PROFILE.birthDate).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-sm font-semibold">
                {calculateAge(ARSENIY_PROFILE.birthDate)}
              </div>
            </div>

            {/* In-Card Stats */}
            <div className="grid grid-cols-3 gap-2 mt-6">
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-white/10">
                <p className="text-[10px] text-blue-100 uppercase font-bold tracking-wider">Вес</p>
                <p className="text-lg font-bold">{currentWeight} <span className="text-xs font-normal opacity-70">кг</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-white/10">
                <p className="text-[10px] text-blue-100 uppercase font-bold tracking-wider">Рост</p>
                <p className="text-lg font-bold">{currentHeight} <span className="text-xs font-normal opacity-70">см</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-white/10">
                <p className="text-[10px] text-blue-100 uppercase font-bold tracking-wider">Голова</p>
                <p className="text-lg font-bold">{currentHead} <span className="text-xs font-normal opacity-70">см</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Add Grid */}
        <div>
          <h3 className="text-gray-700 font-bold mb-3 px-1">Добавить запись</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              EventType.FEEDING, 
              EventType.SLEEP, 
              EventType.WALK, 
              EventType.DIAPER, 
              EventType.BATH, 
              EventType.GROWTH,
              EventType.HEALTH, 
              EventType.PUMPING,
              EventType.MOOD
            ].map(type => {
               const Cfg = EVENT_CONFIG[type];
               const Icon = Cfg.icon;
               return (
                 <button 
                  key={type}
                  onClick={() => {
                    setModalDefaultType(type);
                    setIsModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-blue-300 active:bg-blue-50 transition"
                 >
                   <div className={`p-3 rounded-xl ${Cfg.color}`}>
                     <Icon size={24} />
                   </div>
                   <span className="text-[10px] font-bold text-gray-600">{Cfg.label}</span>
                 </button>
               )
            })}
          </div>
        </div>
      </div>
    );
  };

  const History = () => {
    const [historyMode, setHistoryMode] = useState<'list' | 'visual'>('visual');
    const [filter, setFilter] = useState<EventType | 'ALL'>('ALL');

    // 1. Group events by date (for list separation and daily stats)
    const grouped = events.reduce<Record<string, BabyEvent[]>>((acc, event) => {
      const dateKey = new Date(event.timestamp).toDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event);
      return acc;
    }, {});

    // 2. Prepare Global Filtered List for Visual Timeline (needs all events to check overlaps)
    const filteredGlobalEvents = events.filter(e => filter === 'ALL' || e.type === filter);

    // 3. Prepare Data for Rendering (Iterate grouped days)
    const summaryData = Object.entries(grouped).map(([dateStr, dayEvents]: [string, BabyEvent[]]) => {
        // Daily Stats Calculation (always based on events starting this day)
        let sleepMin = 0;
        let breastMin = 0;
        let bottleMl = 0;
        let diaperCount = 0;
        let walkMin = 0;
        let pumpMl = 0;

        dayEvents.forEach(e => {
            if (e.type === EventType.SLEEP) {
                const sl = e as any;
                if (sl.endTime) sleepMin += (new Date(sl.endTime).getTime() - new Date(sl.timestamp).getTime()) / 60000;
            } else if (e.type === EventType.WALK) {
                const w = e as any;
                if (w.endTime) walkMin += (new Date(w.endTime).getTime() - new Date(w.timestamp).getTime()) / 60000;
            } else if (e.type === EventType.FEEDING) {
                const fd = e as any;
                if (fd.feedingType === 'BREAST' && fd.endTime) breastMin += (new Date(fd.endTime).getTime() - new Date(fd.timestamp).getTime()) / 60000;
                if (fd.feedingType === 'BOTTLE' && fd.amountMl) bottleMl += fd.amountMl;
            } else if (e.type === EventType.DIAPER) {
                diaperCount++;
            } else if (e.type === EventType.PUMPING) {
                if ((e as any).amountMl) pumpMl += (e as any).amountMl;
            }
        });

        // Filter events for LIST view
        const listEvents = dayEvents.filter(e => filter === 'ALL' || e.type === filter);

        return {
            date: new Date(dayEvents[0].timestamp),
            sleepHrs: (sleepMin / 60).toFixed(1),
            walkHrs: (walkMin / 60).toFixed(1),
            breastMin: Math.round(breastMin),
            bottleMl,
            diaperCount,
            pumpMl,
            listEvents // For List Mode
        };
    }).sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-gray-800">История</h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button 
                  onClick={() => setHistoryMode('list')}
                  className={`p-2 rounded-md transition ${historyMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}
                >
                    <List size={20} />
                </button>
                <button 
                  onClick={() => setHistoryMode('visual')}
                  className={`p-2 rounded-md transition ${historyMode === 'visual' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}
                >
                    <BarChart3 size={20} />
                </button>
            </div>
        </div>

        {/* Filter Dropdown */}
        <div className="px-2">
            <div className="relative">
                <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <select 
                    value={filter} 
                    onChange={e => setFilter(e.target.value as any)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none text-gray-600 appearance-none"
                >
                    <option value="ALL">Все события</option>
                    {Object.values(EventType).map(t => (
                        <option key={t} value={t}>{EVENT_CONFIG[t].label}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* --- VISUAL TIMELINE MODE --- */}
        {historyMode === 'visual' && (
            <div className="space-y-4 animate-fade-in">
                {summaryData.length === 0 && (
                  <div className="text-center py-20 text-gray-400">Нет данных для отображения</div>
                )}
                {summaryData.map(day => (
                    <div key={day.date.toISOString()} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-end mb-1">
                           <h3 className="text-lg font-bold text-gray-800">{formatDate(day.date.toISOString())}</h3>
                        </div>
                        
                        <TimelineBar events={filteredGlobalEvents} date={day.date} />
                        
                        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-50">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Сон</p>
                                <p className="text-indigo-600 font-bold">{day.sleepHrs} ч</p>
                            </div>
                             <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Прогулка</p>
                                <p className="text-green-600 font-bold">{day.walkHrs} ч</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Еда/Сцеж</p>
                                <div className="flex flex-col text-xs font-bold text-orange-600">
                                   {day.bottleMl > 0 && <span>{day.bottleMl} мл</span>}
                                   {day.breastMin > 0 && <span>{day.breastMin} мин</span>}
                                   {day.pumpMl > 0 && <span className="text-pink-500">+{day.pumpMl} мл</span>}
                                   {!day.bottleMl && !day.breastMin && !day.pumpMl && <span>-</span>}
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Памп.</p>
                                <p className="text-teal-600 font-bold">{day.diaperCount} шт</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- LIST MODE (Detailed Log) --- */}
        {historyMode === 'list' && (
          <div className="space-y-6">
            {summaryData.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                    <p>Записей пока нет</p>
                </div>
            )}
            {summaryData.map((day) => {
              if (day.listEvents.length === 0) return null;
              
              return (
                <div key={day.date.toISOString()} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-fade-in">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4 sticky top-0 bg-white z-10 py-1">
                    {formatDate(day.date.toISOString())}
                    </h3>
                    <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:h-full before:w-[2px] before:bg-slate-100">
                    {day.listEvents.map((event) => {
                        const Config = EVENT_CONFIG[event.type];
                        const Icon = Config.icon;
                        
                        // Construct Description
                        let desc = '';
                        let durationStr = '';
                        let timeDisplay = formatTime(event.timestamp);

                        if (event.type === EventType.FEEDING) {
                            const e = event as any;
                            desc = `${e.feedingType === 'BREAST' ? 'Грудь' : e.feedingType === 'BOTTLE' ? 'Бутылочка' : 'Прикорм'}`;
                            if (e.amountMl) desc += ` • ${e.amountMl} мл`;
                            if (e.side) desc += ` (${e.side === 'Left' ? 'Л' : e.side === 'Right' ? 'П' : 'Л+П'})`;
                            if (e.endTime) durationStr = calculateDuration(e.timestamp, e.endTime);
                        } else if (event.type === EventType.PUMPING) {
                            const e = event as any;
                            desc = `${e.amountMl} мл`;
                            if (e.side) desc += ` (${e.side === 'Left' ? 'Л' : e.side === 'Right' ? 'П' : 'Л+П'})`;
                        } else if (event.type === EventType.DIAPER) {
                            const e = event as any;
                            desc = e.status === 'WET' ? 'Мокрый' : e.status === 'DIRTY' ? 'Грязный' : 'Смешанный';
                        } else if (event.type === EventType.SLEEP) {
                            const e = event as any;
                            desc = e.subtype === SleepType.NIGHT ? 'Ночной сон' : 'Дневной сон';
                            if (e.endTime) {
                                durationStr = calculateDuration(e.timestamp, e.endTime);
                            } else {
                                desc += ' (В процессе...)';
                            }
                        } else if (event.type === EventType.WALK || event.type === EventType.BATH) {
                            const e = event as any;
                            if (!e.endTime) {
                                desc = 'В процессе...';
                            } else {
                                durationStr = calculateDuration(e.timestamp, e.endTime);
                            }
                        } else if (event.type === EventType.GROWTH) {
                            const e = event as any;
                            const parts = [];
                            if (e.weightKg) parts.push(`${e.weightKg} кг`);
                            if (e.heightCm) parts.push(`${e.heightCm} см`);
                            if (e.headCircumferenceCm) parts.push(`ОГ ${e.headCircumferenceCm} см`);
                            desc = parts.join(' / ');
                        } else if (event.type === EventType.HEALTH) {
                            const e = event as any;
                            const parts = [];
                            if (e.subtype) parts.push(e.subtype === HealthSubtype.TEMPERATURE ? 'Температура' : e.subtype === HealthSubtype.MEDICINE ? 'Лекарство' : e.subtype === HealthSubtype.VACCINE ? 'Прививка' : e.subtype === HealthSubtype.DOCTOR ? 'Врач' : 'Здоровье');
                            if (e.value) parts.push(e.value);
                            if (e.temperature) parts.push(`${e.temperature}°C`);
                            desc = parts.join(': ');
                        } else if (event.type === EventType.MOOD) {
                            desc = (event as any).mood;
                        } else if (event.type === EventType.MILESTONE) {
                            desc = (event as any).title;
                        }

                        return (
                        <div key={event.id} className="relative pl-12 py-1 group">
                            <div className={`absolute left-0 top-1 p-2 rounded-full border-2 bg-white z-10 ${Config.color}`}>
                            <Icon size={14} />
                            </div>
                            <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-bold text-gray-400">{timeDisplay}</span>
                                {durationStr && (
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-medium">
                                    {durationStr}
                                    </span>
                                )}
                                </div>
                                <h4 className="text-sm font-bold text-gray-800">{Config.label}</h4>
                                <p className="text-sm text-gray-500">{desc}</p>
                                {event.note && <p className="text-xs text-gray-400 italic mt-1">"{event.note}"</p>}
                            </div>
                            <button 
                                onClick={() => handleDeleteEvent(event.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-400 transition"
                            >
                                <Trash2 size={16} />
                            </button>
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </div>
            )})}
          </div>
        )}
      </div>
    );
  };

  const GrowthChart = () => {
    // 1. Filter only growth events
    // 2. Sort by date ascending
    // 3. Group by Day to get a single point per day (last reading of the day wins)
    const rawGrowth = events
      .filter(e => e.type === EventType.GROWTH)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const dailyGrowth: Record<string, any> = {};
    rawGrowth.forEach((e: any) => {
        const dateKey = new Date(e.timestamp).toDateString(); // Groups same day
        dailyGrowth[dateKey] = {
            date: new Date(e.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
            weight: e.weightKg > 0 ? e.weightKg : dailyGrowth[dateKey]?.weight,
            height: e.heightCm > 0 ? e.heightCm : dailyGrowth[dateKey]?.height,
            head: e.headCircumferenceCm > 0 ? e.headCircumferenceCm : dailyGrowth[dateKey]?.head
        };
    });

    const growthEvents = Object.values(dailyGrowth);

    if (growthEvents.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-3xl border border-slate-100">
           <Activity size={48} className="mb-4 opacity-20" />
           <p>Нет данных измерений</p>
         </div>
      )
    }

    return (
      <div className="space-y-6 pb-24">
        <h2 className="text-2xl font-bold text-gray-800 px-2">График роста</h2>
        
        {/* Weight */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-gray-600 mb-4">Вес (кг)</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthEvents}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} hide />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="linear" dataKey="weight" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Height */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-gray-600 mb-4">Рост (см)</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthEvents}>
                <defs>
                  <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                <Tooltip />
                <Area type="linear" dataKey="height" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorHeight)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Head */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-gray-600 mb-4">Окружность головы (см)</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthEvents}>
                <defs>
                  <linearGradient id="colorHead" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                <Tooltip />
                <Area type="linear" dataKey="head" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorHead)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    );
  };

  const Settings = () => (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold text-gray-800 px-2">Настройки</h2>
      
      {/* DB Configuration Card */}
      <div className="bg-slate-800 text-slate-200 rounded-3xl overflow-hidden shadow-lg border border-slate-700 p-5 relative">
        <Server className="absolute top-4 right-4 opacity-10" size={64} />
        <h3 className="font-bold text-white mb-2 flex items-center gap-2">
            <Database size={18} />
            PostgREST Sync
        </h3>
        <div className="space-y-4">
             <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">URL API</label>
                <input 
                    type="text" 
                    value={apiUrl}
                    onChange={(e) => saveApiUrl(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 text-slate-200 text-sm p-2 rounded-lg mt-1 outline-none focus:border-blue-500"
                    placeholder="https://..."
                />
             </div>

             <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                    <Key size={10} />
                    Токен (Bearer Token)
                </label>
                <input 
                    type="password" 
                    value={apiToken}
                    onChange={(e) => saveApiToken(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 text-slate-200 text-sm p-2 rounded-lg mt-1 outline-none focus:border-blue-500"
                    placeholder="eyJhbGciOiJIUz..."
                />
                <p className="text-[10px] text-slate-500 mt-1">Оставьте пустым, если сервер публичный.</p>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                 <button 
                    onClick={handlePushToCloud}
                    disabled={isSyncing}
                    className="flex flex-col items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-xs font-bold transition disabled:opacity-50"
                 >
                    {isSyncing ? <RefreshCw className="animate-spin" size={16}/> : <Upload size={16} />}
                    Загрузить на сервер
                 </button>
                 <button 
                    onClick={handlePullFromCloud}
                    disabled={isSyncing}
                    className="flex flex-col items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-xs font-bold transition disabled:opacity-50"
                 >
                     {isSyncing ? <RefreshCw className="animate-spin" size={16}/> : <Download size={16} />}
                    Скачать с сервера
                 </button>
             </div>
             
             <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
                Требуется запущенный PostgREST на порту 3000 (или через прокси). 
                Прямое подключение к Postgres из браузера невозможно.
            </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Управление данными</h3>
          <p className="text-xs text-gray-400">Импорт/Экспорт базы данных JSON/CSV</p>
        </div>
        
        <div className="p-4 space-y-3">
          <button 
            onClick={handleExport}
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Download size={20} />
              </div>
              <span className="font-medium text-gray-700">Экспорт данных (JSON)</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>

          <label className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Upload size={20} />
              </div>
              <span className="font-medium text-gray-700">Импорт данных (JSON/CSV)</span>
            </div>
            <input type="file" accept=".json,.csv" onChange={handleImport} className="hidden" />
            <ChevronRight size={18} className="text-gray-400" />
          </label>
          
          <button 
            onClick={handleSQLExport}
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                <Database size={20} />
              </div>
              <span className="font-medium text-gray-700">Скачать SQL Dump</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-4 mb-4">
           <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
             А
           </div>
           <div>
             <h3 className="font-bold text-gray-800">Арсений</h3>
             <p className="text-sm text-gray-400">Родился 2 сент. 2025</p>
           </div>
        </div>
        <div className="text-sm text-gray-500 space-y-1">
          <p>Вес при рождении: 3.3 кг</p>
          <p>Рост при рождении: 51 см</p>
        </div>
      </div>
      
      <div className="text-center">
         <p className="text-xs text-gray-400">Версия 1.8.0</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto bg-slate-50 min-h-screen relative font-sans text-slate-800 shadow-xl">
      <div className="p-6">
        {view === 'dashboard' && <Dashboard />}
        {view === 'history' && <History />}
        {view === 'stats' && <GrowthChart />}
        {view === 'chat' && <ChatView events={events} />}
        {view === 'settings' && <Settings />}
      </div>

      {/* Floating Action Button (Only on Dashboard) */}
      {view === 'dashboard' && (
        <button
          onClick={() => {
             setModalDefaultType(EventType.FEEDING);
             setIsModalOpen(true);
          }}
          className="fixed bottom-24 right-6 w-14 h-14 bg-baby-darkBlue text-white rounded-full shadow-xl flex items-center justify-center hover:bg-sky-700 active:scale-95 transition z-40"
        >
          <Plus size={28} />
        </button>
      )}

      {/* Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center z-50 max-w-3xl mx-auto">
        <button 
          onClick={() => setView('dashboard')} 
          className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-baby-darkBlue' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className={`p-1 rounded-lg transition ${view === 'dashboard' ? 'bg-blue-50' : ''}`}>
            <Clock size={24} />
          </div>
          <span className="text-[10px] font-bold">Сегодня</span>
        </button>
        
        <button 
          onClick={() => setView('history')} 
          className={`flex flex-col items-center gap-1 ${view === 'history' ? 'text-baby-darkBlue' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className={`p-1 rounded-lg transition ${view === 'history' ? 'bg-blue-50' : ''}`}>
             <Calendar size={24} />
          </div>
          <span className="text-[10px] font-bold">История</span>
        </button>

        <button 
          onClick={() => setView('stats')} 
          className={`flex flex-col items-center gap-1 ${view === 'stats' ? 'text-baby-darkBlue' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className={`p-1 rounded-lg transition ${view === 'stats' ? 'bg-blue-50' : ''}`}>
             <Activity size={24} />
          </div>
          <span className="text-[10px] font-bold">Рост</span>
        </button>

        <button 
          onClick={() => setView('chat')} 
          className={`flex flex-col items-center gap-1 ${view === 'chat' ? 'text-baby-darkBlue' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className={`p-1 rounded-lg transition ${view === 'chat' ? 'bg-blue-50' : ''}`}>
             <MessageCircle size={24} />
          </div>
          <span className="text-[10px] font-bold">Чат</span>
        </button>

        <button 
          onClick={() => setView('settings')} 
          className={`flex flex-col items-center gap-1 ${view === 'settings' ? 'text-baby-darkBlue' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className={`p-1 rounded-lg transition ${view === 'settings' ? 'bg-blue-50' : ''}`}>
             <SettingsIcon size={24} />
          </div>
          <span className="text-[10px] font-bold">Меню</span>
        </button>
      </div>

      <EventModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveEvent}
        defaultType={modalDefaultType}
      />
    </div>
  );
}