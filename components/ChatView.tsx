import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, Moon, Utensils, Footprints, Layers } from 'lucide-react';
import { BabyEvent } from '../types';
import { askBabyAI, ContextFocusMode } from '../services/aiService';

interface ChatViewProps {
  events: BabyEvent[];
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

const SUGGESTIONS = [
  "Как спали сегодня?",
  "Статистика веса и роста",
  "Сколько съел за сегодня?",
  "Анализ режима за неделю",
  "Когда была последняя прививка?"
];

const MODES: { id: ContextFocusMode; label: string; icon: React.ElementType }[] = [
    { id: 'GENERAL', label: 'Общий', icon: Layers },
    { id: 'SLEEP', label: 'Сон', icon: Moon },
    { id: 'FEEDING', label: 'Еда', icon: Utensils },
    { id: 'ACTIVITY', label: 'Активность', icon: Footprints },
];

export const ChatView: React.FC<ChatViewProps> = ({ events }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'ai', text: 'Привет! Я проанализировал дневник Арсения. Что вы хотите узнать?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusMode, setFocusMode] = useState<ContextFocusMode>('GENERAL');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Pass the selected focusMode to the service
      const response = await askBabyAI(text, events, focusMode);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', text: response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', text: 'Произошла ошибка связи с сервером.' };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-slate-50">
      <div className="bg-white p-4 shadow-sm border-b border-gray-100 flex items-center gap-2">
        <div className="p-2 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-xl text-white">
            <Sparkles size={20} />
        </div>
        <div>
            <h2 className="font-bold text-gray-800">Ассистент</h2>
            <p className="text-xs text-gray-400">Powered by Gemini</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'ai' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'
            }`}>
              {msg.role === 'ai' ? <Bot size={18} /> : <User size={18} />}
            </div>
            <div className={`p-3 rounded-2xl max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white rounded-tr-none' 
                : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <Bot size={18} className="text-indigo-400" />
             </div>
             <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 space-y-3">
        {/* Context Focus Selector */}
        <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 px-1">Приоритет данных</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {MODES.map(mode => {
                    const Icon = mode.icon;
                    const isActive = focusMode === mode.id;
                    return (
                        <button
                            key={mode.id}
                            onClick={() => setFocusMode(mode.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                                isActive 
                                    ? 'bg-blue-50 border-blue-500 text-blue-600' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                        >
                            <Icon size={14} />
                            {mode.label}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Suggestions */}
        {messages.length < 3 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {SUGGESTIONS.map(s => (
                <button
                key={s}
                onClick={() => handleSend(s)}
                className="whitespace-nowrap px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-100 border border-transparent hover:border-gray-200 transition"
                >
                {s}
                </button>
            ))}
            </div>
        )}
        
        {/* Input Area */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Спросите про ${focusMode === 'GENERAL' ? 'режим' : MODES.find(m => m.id === focusMode)?.label.toLowerCase()}...`}
            className="flex-1 bg-gray-100 text-gray-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md shadow-blue-200"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};