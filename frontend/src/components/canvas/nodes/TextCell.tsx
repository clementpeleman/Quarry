'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';

interface TextCellData {
  label: string;
  content: string;
  width?: number;
  height?: number;
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
    <>
      <NodeResizer
        minWidth={250}
        minHeight={150}
        isVisible={selected}
        lineClassName="!border-emerald-500"
        handleClassName="!w-2 !h-2 !bg-emerald-500 !border-0"
      />
      <div
        className={`
          w-full h-full min-w-[250px] min-h-[150px]
          bg-zinc-900/90 backdrop-blur-sm rounded-xl border-2 shadow-xl
          transition-colors duration-200 flex flex-col overflow-hidden
          ${selected ? 'border-emerald-500 shadow-emerald-500/20' : 'border-zinc-700'}
        `}
      >
      {/* Header - fixed height */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-zinc-800/50 rounded-t-xl border-b border-zinc-700">
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

      {/* Content - flex-1 fills remaining space, min-h-0 allows proper scrolling */}
      <div
        className="p-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden nodrag"
        onWheelCapture={(e) => e.stopPropagation()}
      >
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full min-h-[60px] bg-transparent text-zinc-300 text-sm resize-none focus:outline-none font-mono"
            placeholder="Write markdown here..."
            onWheelCapture={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="prose prose-invert prose-sm h-full">
            {renderMarkdown(content)}
          </div>
        )}
      </div>

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
    </>
  );
}

export default memo(TextCell);
