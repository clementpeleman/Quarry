'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface TextCellData {
  label: string;
  content: string;
}

function TextCell({ data, selected }: NodeProps) {
  const cellData = data as unknown as TextCellData;
  const [content, setContent] = useState(cellData.content || '');
  const [isEditing, setIsEditing] = useState(false);

  // Simple markdown rendering (basic)
  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-xl font-bold text-white mb-2">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-lg font-semibold text-white mb-2">{line.slice(3)}</h2>;
        }
        // Lists
        if (line.startsWith('- ')) {
          const formatted = formatInline(line.slice(2));
          return <li key={i} className="text-zinc-300 ml-4 list-disc">{formatted}</li>;
        }
        // Empty lines
        if (line.trim() === '') {
          return <br key={i} />;
        }
        // Regular text
        return <p key={i} className="text-zinc-300">{formatInline(line)}</p>;
      });
  };

  const formatInline = (text: string) => {
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<b class="font-bold text-white">$1</b>');
    // Italic
    text = text.replace(/\*(.*?)\*/g, '<i class="italic">$1</i>');
    // Code
    text = text.replace(/`(.*?)`/g, '<code class="bg-zinc-800 px-1 rounded text-indigo-400">$1</code>');
    
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  return (
    <div
      className={`
        min-w-[300px] max-w-[400px]
        bg-zinc-900/90 backdrop-blur-sm rounded-xl border-2 shadow-xl
        transition-all duration-200
        ${selected ? 'border-emerald-500 shadow-emerald-500/20' : 'border-zinc-700'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 rounded-t-xl border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-zinc-300">{cellData.label}</span>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-zinc-500 hover:text-white transition-colors"
        >
          {isEditing ? 'Preview' : 'Edit'}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 min-h-[100px]">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-32 bg-transparent text-zinc-300 text-sm resize-none focus:outline-none font-mono"
            placeholder="Write markdown here..."
          />
        ) : (
          <div className="prose prose-invert prose-sm">
            {renderMarkdown(content)}
          </div>
        )}
      </div>

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-zinc-900"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-zinc-900"
      />
    </div>
  );
}

export default memo(TextCell);
