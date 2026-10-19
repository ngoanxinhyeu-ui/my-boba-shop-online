import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Role, RoomState } from '../../shared/types.ts';
import { MessageSquare, Lock, Globe, Send, Smile } from 'lucide-react';

interface ChatPanelProps {
  room: RoomState;
  myPlayerId: string;
  myRole: Role;
  messages: ChatMessage[];
  onSendMessage: (text: string, type: 'global' | 'whisper', recipientId?: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  room,
  myPlayerId,
  myRole,
  messages,
  onSendMessage,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true); // Default collapsed for clean zero-scroll workstation
  const [activeTab, setActiveTab] = useState<'global' | 'whisper'>('global');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const globalMessages = messages.filter((m) => m.type === 'global');
  const whisperMessages = messages.filter((m) => m.type === 'whisper');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    // Determine whisper recipient
    let recipientId: string | undefined = undefined;
    if (activeTab === 'whisper') {
      const otherPlayer = Object.values(room.players).find(
        (p) => p.id !== myPlayerId && p.role !== myRole
      );
      recipientId = otherPlayer?.id;
    }

    onSendMessage(inputText.trim(), activeTab, recipientId);
    setInputText('');
  };

  const quickMacros = [
    'Cho nhiều trân châu nhé! 🧋',
    'Đang làm sắp xong rồi nha! ⏱️',
    'Làm nhanh giùm tôi với! 🚨',
    'Món ngon tuyệt vời! ⭐⭐⭐⭐⭐',
  ];

  if (isCollapsed) {
    return (
      <div
        onClick={() => setIsCollapsed(false)}
        className="p-2.5 bg-white/95 backdrop-blur-md rounded-2xl border-2 border-amber-300 shadow-sm flex items-center justify-between cursor-pointer hover:bg-amber-50 transition text-xs select-none"
      >
        <div className="flex items-center gap-2 font-black text-amber-950">
          <MessageSquare className="w-4 h-4 text-orange-600" />
          <span>Khung Trò Chuyện ({messages.length} tin nhắn)</span>
        </div>
        <span className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1">
          <span>Mở chat</span> ▲
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl border-2 border-amber-300 shadow-lg flex flex-col h-[280px] overflow-hidden">
      {/* Dual Tab Header */}
      <div className="flex items-center border-b border-amber-200 bg-amber-50">
        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 py-2 px-2.5 font-bold text-xs flex items-center justify-center gap-1.5 transition ${
            activeTab === 'global'
              ? 'bg-white text-orange-700 border-b-2 border-orange-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-orange-500" />
          <span>Chat Chung ({globalMessages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('whisper')}
          className={`flex-1 py-2 px-2.5 font-bold text-xs flex items-center justify-center gap-1.5 transition ${
            activeTab === 'whisper'
              ? 'bg-white text-purple-700 border-b-2 border-purple-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-purple-600" />
          <span>Thì Thầm ({whisperMessages.length})</span>
        </button>

        <button
          onClick={() => setIsCollapsed(true)}
          className="px-2.5 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-800 border-l border-amber-200 hover:bg-amber-100 transition"
          title="Thu gọn khung chat"
        >
          ▼ Thu gọn
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
        {(activeTab === 'global' ? globalMessages : whisperMessages).map((msg) => {
          const isMe = msg.senderId === myPlayerId;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
                <span className="font-bold text-slate-700">
                  {msg.senderName} ({msg.role === 'seller' ? 'Người Bán' : 'Khách'})
                </span>
                <span>• {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div
                className={`px-3 py-1.5 rounded-2xl max-w-[85%] font-medium break-words shadow-xs ${
                  isMe
                    ? activeTab === 'whisper'
                      ? 'bg-purple-600 text-white rounded-tr-xs'
                      : 'bg-orange-600 text-white rounded-tr-xs'
                    : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-xs'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        {(activeTab === 'global' ? globalMessages : whisperMessages).length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            Chưa có tin nhắn trong khung này. Hãy gửi lời chào nhé!
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Macros */}
      <div className="px-2 py-1 bg-amber-50 border-t border-amber-200 flex gap-1 overflow-x-auto no-scrollbar">
        {quickMacros.map((macro, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(macro, activeTab)}
            className="text-[10px] whitespace-nowrap bg-white hover:bg-amber-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full border border-amber-200 shrink-0"
          >
            {macro}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-2 bg-white border-t border-amber-200 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            activeTab === 'global'
              ? 'Nhập tin nhắn chung cho cả phòng...'
              : 'Thì thầm riêng với Người Bán / Khách...'
          }
          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 font-medium"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl shadow transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
