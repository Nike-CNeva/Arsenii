import { GoogleGenAI } from "@google/genai";
import { BabyEvent, EventType, FeedingType, SleepType, HealthSubtype } from "../types";
import { ARSENIY_PROFILE } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export type ContextFocusMode = 'GENERAL' | 'SLEEP' | 'FEEDING' | 'ACTIVITY';

const formatEventForAI = (e: BabyEvent): string => {
  const date = new Date(e.timestamp).toLocaleString('ru-RU');
  let details = '';

  switch (e.type) {
    case EventType.SLEEP:
      details = `Сон (${(e as any).subtype === SleepType.NIGHT ? 'Ночной' : 'Дневной'})`;
      if ((e as any).endTime) details += ` до ${new Date((e as any).endTime).toLocaleTimeString('ru-RU')}`;
      else details += ` (еще идет)`;
      break;
    case EventType.FEEDING:
      details = `Еда: ${(e as any).feedingType}`;
      if ((e as any).amountMl) details += ` ${(e as any).amountMl}мл`;
      if ((e as any).side) details += ` (${(e as any).side})`;
      break;
    case EventType.GROWTH:
      details = `Рост/Вес: ${(e as any).weightKg || '-'}кг, ${(e as any).heightCm || '-'}см, Голова: ${(e as any).headCircumferenceCm || '-'}см`;
      break;
    case EventType.HEALTH:
      details = `Здоровье: ${(e as any).subtype} - ${(e as any).value || ''} ${(e as any).temperature ? `T:${(e as any).temperature}` : ''}`;
      break;
    case EventType.MOOD:
      details = `Настроение: ${(e as any).mood}`;
      break;
    case EventType.PUMPING:
      details = `Сцеживание: ${(e as any).amountMl}мл`;
      break;
    case EventType.DIAPER:
      details = `Подгузник: ${(e as any).status}`;
      break;
    case EventType.MILESTONE:
      details = `Достижение: ${(e as any).title}`;
      break;
    case EventType.WALK:
      details = `Прогулка`;
      if ((e as any).endTime) details += ` до ${new Date((e as any).endTime).toLocaleTimeString('ru-RU')}`;
      break;
    case EventType.BATH:
      details = `Купание`;
      if ((e as any).endTime) details += ` до ${new Date((e as any).endTime).toLocaleTimeString('ru-RU')}`;
      break;
    default:
      details = (e as any).type;
  }
  
  if (e.note) details += ` Прим: "${e.note}"`;
  return `[${date}] ${details}`;
};

export const askBabyAI = async (userQuery: string, events: BabyEvent[], focusMode: ContextFocusMode = 'GENERAL') => {
  if (!events || events.length === 0) {
    return "В базе данных пока нет записей. Пожалуйста, добавьте события или импортируйте историю из CSV.";
  }

  // 1. Vital types - ALWAYS Included completely
  const vitalTypes = new Set([EventType.GROWTH, EventType.HEALTH, EventType.MILESTONE]);
  const vitalEvents = events.filter(e => vitalTypes.has(e.type));
  
  // 2. Routine events - Handled based on Focus Mode
  const routineEvents = events.filter(e => !vitalTypes.has(e.type)); // Assumed sorted Newest -> Oldest from storage
  
  let selectedRoutineEvents: BabyEvent[] = [];
  let focusInstruction = "";

  if (focusMode === 'GENERAL') {
    // Standard mode: Last 500 events mixed
    selectedRoutineEvents = routineEvents.slice(0, 500);
    focusInstruction = "Анализ общего режима дня.";
  } else {
    // Focused Mode Logic:
    // A. "Short Term Context": Last ~3 days of EVERYTHING (approx 200 events)
    // This allows the AI to see how sleep affects food, etc. recently.
    const shortTermContext = routineEvents.slice(0, 200);

    // B. "Deep History": All events of the specific type (up to 2000)
    let targetTypes: EventType[] = [];
    if (focusMode === 'SLEEP') targetTypes = [EventType.SLEEP];
    else if (focusMode === 'FEEDING') targetTypes = [EventType.FEEDING, EventType.PUMPING];
    else if (focusMode === 'ACTIVITY') targetTypes = [EventType.WALK, EventType.BATH, EventType.MOOD];

    const deepHistory = routineEvents
      .filter(e => targetTypes.includes(e.type))
      .slice(0, 2000);

    // C. Merge and Deduplicate (by ID)
    const eventMap = new Map<string, BabyEvent>();
    shortTermContext.forEach(e => eventMap.set(e.id, e));
    deepHistory.forEach(e => eventMap.set(e.id, e));
    
    selectedRoutineEvents = Array.from(eventMap.values());
    focusInstruction = `ПРИОРИТЕТ АНАЛИЗА: ${focusMode}. В данных предоставлена глубокая история по категории ${focusMode}, а также контекст остальных событий за последние 3 дня.`;
  }

  // Combine and Sort Chronologically (Oldest -> Newest)
  const finalContextEvents = [...vitalEvents, ...selectedRoutineEvents].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const contextData = finalContextEvents.map(formatEventForAI).join('\n');
  
  const systemPrompt = `
    Ты - педиатрический аналитик данных и персональный ассистент для родителей ребенка по имени ${ARSENIY_PROFILE.name}.
    
    КОНТЕКСТНАЯ ИНФОРМАЦИЯ:
    - Дата рождения: ${new Date(ARSENIY_PROFILE.birthDate).toLocaleDateString('ru-RU')}
    - Текущее время: ${new Date().toLocaleString('ru-RU')}
    
    ${focusInstruction}

    ИСТОРИЯ СОБЫТИЙ:
    (Примечание: Важные медицинские данные и замеры предоставлены за всё время).
    =========================================
    ${contextData}
    =========================================
    
    ТВОЯ ЗАДАЧА: 
    Отвечать на вопросы родителей, основываясь ИСКЛЮЧИТЕЛЬНО на предоставленных выше данных.
    
    ПРАВИЛА:
    1. Если в данных нет ответа на вопрос, так и скажи честно.
    2. При расчете статистики будь точен.
    3. Используй русский язык и дружелюбный тон.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userQuery,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return response.text || "Извините, я проанализировал данные, но не смог сформировать текстовый ответ.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Произошла ошибка при обращении к серверу ИИ. Попробуйте позже.";
  }
};