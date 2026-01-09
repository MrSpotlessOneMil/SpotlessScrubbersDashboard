"use client";

interface MessageBubbleProps {
  role: 'client' | 'business' | 'bot';
  content: string;
  timestamp: string;
  showTimestamp?: boolean;
}

export function MessageBubble({ role, content, timestamp, showTimestamp = true }: MessageBubbleProps) {
  const isClient = role === 'client';
  const isBot = role === 'bot';

  return (
    <div className={`flex ${isClient ? 'justify-start' : 'justify-end'} mb-2`}>
      <div
        className={`max-w-[75%] px-4 py-3 ${
          isClient
            ? 'bg-zinc-700/80 text-zinc-100 rounded-2xl rounded-bl-md'
            : isBot
            ? 'bg-purple-500/90 text-white rounded-2xl rounded-br-md'
            : 'bg-emerald-500/80 text-white rounded-2xl rounded-br-md'
        }`}
      >
        {/* Role label */}
        <div className={`text-[9px] uppercase tracking-wider mb-1 font-medium ${
          isClient
            ? 'text-zinc-400'
            : isBot
            ? 'text-purple-200'
            : 'text-emerald-200'
        }`}>
          {role === 'client' ? 'Customer' : role === 'bot' ? 'The Clean Machine' : 'You'}
        </div>

        {/* Message content */}
        <div className="text-sm leading-relaxed">{content}</div>

        {/* Timestamp */}
        {showTimestamp && (
          <div className={`text-[10px] mt-1.5 ${
            isClient
              ? 'text-zinc-500'
              : isBot
              ? 'text-purple-200/70'
              : 'text-emerald-200/70'
          }`}>
            {new Date(timestamp).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit'
            })}
          </div>
        )}
      </div>
    </div>
  );
}
