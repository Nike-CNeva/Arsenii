import React, { useState, useEffect } from 'react';
import { EventType, FeedingType, DiaperType, BabyEvent, HealthSubtype, SleepType } from '../types';
import { EVENT_CONFIG } from '../constants';
import { X } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: BabyEvent) => void;
  defaultType: EventType;
}

const toLocalISO = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, defaultType }) => {
  const [activeType, setActiveType] = useState<EventType>(defaultType);
  
  // Common Form States
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [note, setNote] = useState('');

  // Specific States
  const [amount, setAmount] = useState<string>('');
  const [feedingType, setFeedingType] = useState<FeedingType>(FeedingType.BOTTLE);
  const [diaperStatus, setDiaperStatus] = useState<DiaperType>(DiaperType.WET);
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [headCirc, setHeadCirc] = useState<string>('');
  const [healthSubtype, setHealthSubtype] = useState<HealthSubtype>(HealthSubtype.MEDICINE);
  const [healthValue, setHealthValue] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [mood, setMood] = useState<string>('Веселый');
  const [milestoneTitle, setMilestoneTitle] = useState<string>('');
  const [pumpSide, setPumpSide] = useState<'Left' | 'Right' | 'Both'>('Both');
  const [sleepType, setSleepType] = useState<SleepType>(SleepType.DAY);

  // Initialize dates when opening
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setEndTime(toLocalISO(now));
      const start = new Date(now.getTime() - 30 * 60000);
      setStartTime(toLocalISO(start));
      setActiveType(defaultType);
      
      // Auto-guess sleep type
      const hour = now.getHours();
      setSleepType(hour >= 21 || hour < 7 ? SleepType.NIGHT : SleepType.DAY);
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  const isDurationEvent = 
    activeType === EventType.SLEEP || 
    activeType === EventType.WALK || 
    activeType === EventType.BATH ||
    (activeType === EventType.FEEDING && feedingType === FeedingType.BREAST);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalTimestamp = isDurationEvent ? new Date(startTime).toISOString() : new Date(endTime).toISOString();
    
    const base = {
      id: crypto.randomUUID(),
      timestamp: finalTimestamp,
      note: note || undefined,
    };

    let newEvent: BabyEvent;

    switch (activeType) {
      case EventType.FEEDING:
        newEvent = {
          ...base,
          type: EventType.FEEDING,
          feedingType,
          amountMl: amount ? Number(amount) : undefined,
          endTime: feedingType === FeedingType.BREAST ? new Date(endTime).toISOString() : undefined,
          side: feedingType === FeedingType.BREAST ? pumpSide : undefined
        };
        break;
      case EventType.PUMPING:
        newEvent = {
          ...base,
          type: EventType.PUMPING,
          amountMl: Number(amount),
          side: pumpSide
        };
        break;
      case EventType.DIAPER:
        newEvent = {
          ...base,
          type: EventType.DIAPER,
          status: diaperStatus,
        };
        break;
      case EventType.SLEEP:
        newEvent = { 
            ...base, 
            type: EventType.SLEEP, 
            endTime: new Date(endTime).toISOString(),
            subtype: sleepType
        };
        break;
      case EventType.WALK:
        newEvent = { ...base, type: EventType.WALK, endTime: new Date(endTime).toISOString() };
        break;
      case EventType.BATH:
        newEvent = { ...base, type: EventType.BATH, endTime: new Date(endTime).toISOString() };
        break;
      case EventType.GROWTH:
        newEvent = {
          ...base,
          type: EventType.GROWTH,
          weightKg: weight ? Number(weight) : undefined,
          heightCm: height ? Number(height) : undefined,
          headCircumferenceCm: headCirc ? Number(headCirc) : undefined
        };
        break;
      case EventType.HEALTH:
        newEvent = {
          ...base,
          type: EventType.HEALTH,
          subtype: healthSubtype,
          value: healthValue,
          temperature: temperature ? Number(temperature) : undefined,
        };
        break;
      case EventType.MOOD:
        newEvent = {
          ...base,
          type: EventType.MOOD,
          mood: mood
        };
        break;
      case EventType.MILESTONE:
        newEvent = {
          ...base,
          type: EventType.MILESTONE,
          title: milestoneTitle
        };
        break;
      default:
        return;
    }

    onSave(newEvent);
    // Reset fields
    setNote('');
    setAmount('');
    setHealthValue('');
    setMilestoneTitle('');
    onClose();
  };

  const Config = EVENT_CONFIG[activeType];
  const Icon = Config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className={`p-4 flex justify-between items-center ${Config.color.split(' ')[0]}`}>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-full text-inherit">
              <Icon size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Новая запись</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 rounded-full hover:bg-white/40 transition">
            <X size={20} className="text-gray-700" />
          </button>
        </div>

        {/* Type Selector (Tabs) */}
        <div className="flex flex-wrap justify-center p-3 gap-2 bg-gray-50">
          {Object.values(EventType).map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeType === t 
                  ? 'bg-blue-500 text-white shadow-md' 
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {EVENT_CONFIG[t].label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 pt-2">
          
          {/* Time Inputs */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
             {isDurationEvent ? (
               <>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Начало</label>
                  <input 
                    type="datetime-local" 
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Конец</label>
                  <input 
                    type="datetime-local" 
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
               </>
             ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Время события</label>
                  <input 
                    type="datetime-local" 
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-white p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
             )}
          </div>

          {/* Dynamic Fields */}
          {activeType === EventType.SLEEP && (
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип сна</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  {[SleepType.DAY, SleepType.NIGHT].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSleepType(st)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${sleepType === st ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                    >
                      {st === SleepType.DAY ? 'Дневной' : 'Ночной'}
                    </button>
                  ))}
                </div>
             </div>
          )}

          {activeType === EventType.FEEDING && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип кормления</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  {Object.values(FeedingType).map(ft => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setFeedingType(ft)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${feedingType === ft ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    >
                      {ft === 'BREAST' ? 'Грудь' : ft === 'BOTTLE' ? 'Бутылка' : 'Еда'}
                    </button>
                  ))}
                </div>
              </div>
              {feedingType !== FeedingType.BREAST && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Количество (мл/гр)</label>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="150"
                  />
                </div>
              )}
              {feedingType === FeedingType.BREAST && (
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Сторона</label>
                    <div className="flex gap-2">
                        {['Left', 'Right', 'Both'].map((s: any) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setPumpSide(s)}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${pumpSide === s ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-500'}`}
                            >
                                {s === 'Left' ? 'Левая' : s === 'Right' ? 'Правая' : 'Обе'}
                            </button>
                        ))}
                    </div>
                 </div>
              )}
            </div>
          )}

          {activeType === EventType.PUMPING && (
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Количество (мл)</label>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="100"
                    required
                  />
               </div>
               <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Сторона</label>
                    <div className="flex gap-2">
                        {['Left', 'Right', 'Both'].map((s: any) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setPumpSide(s)}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${pumpSide === s ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-500'}`}
                            >
                                {s === 'Left' ? 'Левая' : s === 'Right' ? 'Правая' : 'Обе'}
                            </button>
                        ))}
                    </div>
               </div>
            </div>
          )}

          {activeType === EventType.DIAPER && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Состояние</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: DiaperType.WET, label: 'Мокрый' },
                  { id: DiaperType.DIRTY, label: 'Грязный' },
                  { id: DiaperType.MIXED, label: 'Смешанный' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDiaperStatus(opt.id)}
                    className={`py-3 rounded-xl border text-sm font-medium transition ${diaperStatus === opt.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeType === EventType.GROWTH && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Вес (кг)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={weight} 
                    onChange={e => setWeight(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="3.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Рост (см)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={height} 
                    onChange={e => setHeight(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="52"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Окружность головы (см)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={headCirc} 
                  onChange={e => setHeadCirc(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="35"
                />
              </div>
            </div>
          )}

           {activeType === EventType.HEALTH && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                <select 
                    value={healthSubtype}
                    onChange={e => setHealthSubtype(e.target.value as HealthSubtype)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value={HealthSubtype.MEDICINE}>Лекарство</option>
                    <option value={HealthSubtype.DOCTOR}>Врач</option>
                    <option value={HealthSubtype.VACCINE}>Прививка</option>
                    <option value={HealthSubtype.SICKNESS}>Болезнь/Симптом</option>
                    <option value={HealthSubtype.TEMPERATURE}>Температура</option>
                    <option value={HealthSubtype.OTHER}>Другое</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название / Значение</label>
                <input 
                  type="text" 
                  value={healthValue} 
                  onChange={e => setHealthValue(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: Витамин Д, Педиатр..."
                />
              </div>

              {healthSubtype === HealthSubtype.TEMPERATURE && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Температура (°C)</label>
                    <input 
                    type="number" 
                    step="0.1"
                    value={temperature} 
                    onChange={e => setTemperature(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="36.6"
                    />
                </div>
              )}
            </div>
          )}

          {activeType === EventType.MOOD && (
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Настроение</label>
                <div className="grid grid-cols-2 gap-2">
                    {['Веселый', 'Спокойный', 'Капризный', 'Плач'].map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMood(m)}
                            className={`py-2 rounded-lg text-sm border ${mood === m ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'border-gray-200'}`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
             </div>
          )}

          {activeType === EventType.MILESTONE && (
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название события</label>
                <input 
                  type="text" 
                  value={milestoneTitle} 
                  onChange={e => setMilestoneTitle(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Первая улыбка..."
                  required
                />
             </div>
          )}

          {/* Common Note Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Примечание</label>
            <textarea 
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Дополнительные детали..."
            />
          </div>

          <button 
            type="submit" 
            className="w-full py-4 bg-baby-darkBlue text-white font-bold rounded-xl shadow-lg hover:bg-sky-700 active:scale-95 transition-transform"
          >
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
};