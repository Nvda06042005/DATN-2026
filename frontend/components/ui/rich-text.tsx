import React from 'react';

/** Hiển thị markdown đơn giản của kho tri thức (**đậm**, gạch đầu dòng •) */
export const RichText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <div className={`space-y-2 leading-relaxed ${className}`}>
    {text
      .split(/\n+/)
      .filter((l) => l.trim())
      .map((line, i) => {
        const bullet = /^\s*[•\-*]\s+/.test(line);
        const body = line.replace(/^\s*[•\-*]\s+/, '');
        const parts = body.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j} className="font-bold text-muc">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <React.Fragment key={j}>{part}</React.Fragment>
          )
        );
        return bullet ? (
          <p key={i} className="flex gap-2">
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-dong shrink-0" aria-hidden="true" />
            <span>{parts}</span>
          </p>
        ) : (
          <p key={i}>{parts}</p>
        );
      })}
  </div>
);
