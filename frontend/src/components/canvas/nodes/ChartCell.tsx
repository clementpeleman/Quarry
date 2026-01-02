'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import ReactECharts from 'echarts-for-react';

interface ChartCellData {
  label: string;
  chartType: 'bar' | 'line' | 'pie' | 'bigNumber';
  sql?: string;
  results?: {
    columns: string[];
    rows: any[][];
  };
  data?: {
    labels?: string[];
    values?: number[];
    value?: number | string;
    title?: string;
  };
  // Column mapping from connected SQL cell
  columnMapping?: {
    xColumn: string;
    yColumn: string;
  };
  sourceNodeId?: string;
  onRun?: (sql: string) => Promise<void>;
  isExecuting?: boolean;
  width?: number;
  height?: number;
}

function ChartCell({ data, selected }: NodeProps) {
  const cellData = data as unknown as ChartCellData;
  const [showConfig, setShowConfig] = useState(false);
  const [sql, setSql] = useState(cellData.sql || '');

  // Process data from results or static data
  const processedData = useMemo(() => {
    if (cellData.results && cellData.results.rows.length > 0) {
      const rows = cellData.results.rows;
      const columns = cellData.results.columns;
      
      // Use column mapping if available
      if (cellData.columnMapping) {
        const xIndex = columns.indexOf(cellData.columnMapping.xColumn);
        const yIndex = columns.indexOf(cellData.columnMapping.yColumn);
        if (xIndex !== -1 && yIndex !== -1) {
          return {
            labels: rows.map(r => String(r[xIndex])),
            values: rows.map(r => Number(r[yIndex])),
            value: rows[0][yIndex],
            title: cellData.columnMapping.yColumn
          };
        }
      }
      
      // Auto-detect: First column is X, Second is Y
      return {
        labels: rows.map(r => String(r[0])),
        values: rows.map(r => Number(r[1])),
        value: rows[0][0],
        title: columns[0]
      };
    }
    return cellData.data || {
      labels: ['A', 'B', 'C'],
      values: [10, 20, 30],
      value: 0,
    };
  }, [cellData.results, cellData.data, cellData.columnMapping]);

  const handleRun = useCallback(() => {
    if (cellData.onRun) {
        cellData.onRun(sql);
    }
  }, [cellData, sql]);

  const chartOptions = useMemo(() => {
    if (cellData.chartType === 'bigNumber') return null;

    return {
      backgroundColor: 'transparent',
      grid: { top: 20, right: 20, bottom: 30, left: 40 },
      xAxis: {
        type: 'category',
        data: processedData.labels,
        axisLabel: { color: '#71717a', fontSize: 11 },
        axisLine: { lineStyle: { color: '#3f3f46' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#71717a', fontSize: 11 },
        splitLine: { lineStyle: { color: '#27272a' } },
      },
      series: [
        {
          data: processedData.values,
          type: cellData.chartType || 'bar',
          itemStyle: {
            color: '#6366f1',
            borderRadius: [4, 4, 0, 0],
          },
          smooth: true,
        },
      ],
      tooltip: { trigger: 'axis', backgroundColor: '#18181b', textStyle: { color: '#fff' } },
    };
  }, [cellData.chartType, processedData]);

  return (
    <div
      className={`
        min-w-[300px] min-h-[250px]
        bg-zinc-900/90 backdrop-blur-sm rounded-xl border-2 shadow-xl
        transition-all duration-200
        ${selected ? 'border-violet-500 shadow-violet-500/20' : 'border-zinc-700'}
      `}
      style={{ width: cellData.width || 380, height: cellData.height || 'auto' }}
    >
      <NodeResizer 
        minWidth={300} 
        minHeight={250}
        isVisible={selected}
        lineClassName="!border-violet-500"
        handleClassName="!w-2 !h-2 !bg-violet-500 !border-0"
      />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 rounded-t-xl border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-violet-500" />
          <span className="text-sm font-medium text-zinc-300">{cellData.label}</span>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs text-zinc-500 hover:text-white"
            >
                {showConfig ? 'Hide Config' : 'Config'}
            </button>
            <span className="text-xs text-zinc-500 capitalize px-2 py-0.5 bg-zinc-800 rounded">{cellData.chartType}</span>
        </div>
      </div>

      {/* Config Area */}
      {showConfig && (
          <div className="p-3 bg-zinc-800/30 border-b border-zinc-700">
              <textarea 
                value={sql}
                onChange={e => setSql(e.target.value)}
                className="w-full text-xs font-mono bg-zinc-950 p-2 rounded border border-zinc-700 text-zinc-300 mb-2 focus:outline-none focus:border-violet-500"
                placeholder="SELECT category, value FROM {{cell}}"
                rows={3}
              />
              <button 
                onClick={handleRun}
                className="w-full py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded transition-colors"
              >
                  Update Chart
              </button>
          </div>
      )}

      {/* Chart */}
      <div className="p-2">
        {cellData.chartType === 'bigNumber' ? (
          <div className="flex flex-col items-center justify-center py-6">
            <span className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              {processedData.value ?? 'N/A'}
            </span>
            {processedData.title && (
              <span className="text-sm text-zinc-500 mt-1">{processedData.title}</span>
            )}
          </div>
        ) : (
          <ReactECharts
            option={chartOptions}
            style={{ height: 200 }}
            opts={{ renderer: 'canvas' }}
          />
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-violet-500 !border-2 !border-zinc-900" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-violet-500 !border-2 !border-zinc-900" />
    </div>
  );
}

export default memo(ChartCell);
