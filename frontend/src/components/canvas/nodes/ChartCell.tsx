'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import ReactECharts from 'echarts-for-react';
import ColumnMappingModal from '../ColumnMappingModal';

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
  onChartTypeChange?: (type: 'bar' | 'line' | 'pie' | 'bigNumber') => void;
  isExecuting?: boolean;
  width?: number;
  height?: number;
}

function ChartCell({ data, selected, id }: NodeProps) {
  const cellData = data as unknown as ChartCellData;
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [localMapping, setLocalMapping] = useState(cellData.columnMapping);

  // Check if we have actual data to display
  const hasData = cellData.results && cellData.results.rows.length > 0;
  const columns = cellData.results?.columns || [];

  // Process data from results or static data
  const processedData = useMemo(() => {
    if (cellData.results && cellData.results.rows.length > 0) {
      const rows = cellData.results.rows;
      const cols = cellData.results.columns;

      // Use local mapping or cellData mapping if available
      const mapping = localMapping || cellData.columnMapping;
      if (mapping) {
        const xIndex = cols.indexOf(mapping.xColumn);
        const yIndex = cols.indexOf(mapping.yColumn);
        if (xIndex !== -1 && yIndex !== -1) {
          return {
            labels: rows.map(r => String(r[xIndex])),
            values: rows.map(r => Number(r[yIndex])),
            value: rows[0][yIndex],
            title: mapping.yColumn
          };
        }
      }

      // Auto-detect: First column is X, Second is Y
      return {
        labels: rows.map(r => String(r[0])),
        values: rows.map(r => Number(r[1])),
        value: rows[0][0],
        title: cols[0]
      };
    }
    return null; // No data - show placeholder
  }, [cellData.results, localMapping, cellData.columnMapping]);

  const handleMappingSave = useCallback((mapping: { xColumn: string; yColumn: string }) => {
    setLocalMapping(mapping);
    setShowMappingModal(false);
  }, []);

  const chartOptions = useMemo(() => {
    if (cellData.chartType === 'bigNumber' || !processedData) return null;

    // Pie chart has different config
    if (cellData.chartType === 'pie') {
      return {
        backgroundColor: 'transparent',
        tooltip: { 
          trigger: 'item', 
          backgroundColor: '#18181b', 
          textStyle: { color: '#fff' },
          formatter: '{b}: {c} ({d}%)'
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '55%'],
          data: processedData.labels.map((label, i) => ({
            name: label,
            value: processedData.values[i]
          })),
          itemStyle: {
            borderRadius: 4,
            borderColor: '#18181b',
            borderWidth: 2,
          },
          label: {
            color: '#a1a1aa',
            fontSize: 11,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }],
        color: ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe', '#818cf8'],
      };
    }

    // Bar/Line chart config
    return {
      backgroundColor: 'transparent',
      grid: { top: 20, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: 'category',
        data: processedData.labels,
        axisLabel: { color: '#71717a', fontSize: 11, rotate: processedData.labels.length > 5 ? 30 : 0 },
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
            borderRadius: cellData.chartType === 'bar' ? [4, 4, 0, 0] : 0,
          },
          smooth: true,
          areaStyle: cellData.chartType === 'line' ? { opacity: 0.1 } : undefined,
        },
      ],
      tooltip: { trigger: 'axis', backgroundColor: '#18181b', textStyle: { color: '#fff' } },
    };
  }, [cellData.chartType, processedData]);

  return (
    <>
      <NodeResizer
        minWidth={300}
        minHeight={250}
        isVisible={selected}
        lineClassName="!border-violet-500"
        handleClassName="!w-2 !h-2 !bg-violet-500 !border-0"
      />
      {/* Outer wrapper: Full size, relative, with extended hover zone via pseudo-element */}
      <div className="group relative w-full h-full before:absolute before:-inset-4 before:-z-10 before:content-['']">
        {/* Visual Node: Full size, contains border/bg/shadow/content */}
        <div
          className={`
            w-full h-full min-w-[300px] min-h-[250px] relative
            bg-zinc-900/90 backdrop-blur-sm rounded-xl border-2 shadow-xl
            transition-colors duration-200 flex flex-col overflow-hidden
            ${selected ? 'border-violet-500 shadow-violet-500/20' : 'border-zinc-700'}
          `}
        >
      {/* Header - fixed height */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-zinc-800/50 rounded-t-xl border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-violet-500" />
          <span className="text-sm font-medium text-zinc-300">{cellData.label}</span>
        </div>
        <div className="flex items-center gap-2">
            {/* Chart Type Selector */}
            <div className="flex bg-zinc-800 rounded-md p-0.5 border border-zinc-700">
              {(['bar', 'line', 'pie', '#'] as const).map((type) => {
                const chartType = type === '#' ? 'bigNumber' : type;
                const label = type === '#' ? '#' : type.charAt(0).toUpperCase() + type.slice(1);
                return (
                  <button 
                    key={type}
                    onClick={() => cellData.onChartTypeChange?.(chartType as any)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                      cellData.chartType === chartType 
                        ? 'bg-violet-600 text-white' 
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title={chartType === 'bigNumber' ? 'Big Number' : `${label} Chart`}
                  >{label}</button>
                );
              })}
            </div>
            {hasData && (
              <button
                onClick={() => setShowMappingModal(true)}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                Config
              </button>
            )}
        </div>
      </div>

      {/* Chart - flex-1 fills remaining space, min-h-0 allows shrinking */}
      <div className="p-2 flex-1 min-h-0">
        {!hasData ? (
          /* Placeholder when no data */
          <div className="flex flex-col items-center justify-center h-full text-zinc-500/50">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm">Connect a SQL cell to visualize data</span>
          </div>
        ) : cellData.chartType === 'bigNumber' ? (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              {processedData?.value ?? 'N/A'}
            </span>
            {processedData?.title && (
              <span className="text-sm text-zinc-500 mt-1">{processedData.title}</span>
            )}
          </div>
        ) : chartOptions ? (
          <ReactECharts
            key={cellData.chartType} // Force re-mount when chart type changes
            option={chartOptions}
            notMerge={true} // Don't merge with old config
            style={{ height: '100%', width: '100%', minHeight: 160 }}
            opts={{ renderer: 'canvas' }}
          />
        ) : null}
      </div>
      </div>
        {/* Connection handles - positioned outside via negative margins/positioning */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="!w-2.5 !h-2.5 !bg-violet-500 !border-2 !border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto !top-[-5px]"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!w-2.5 !h-2.5 !bg-violet-500 !border-2 !border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto !bottom-[-5px]"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-2.5 !h-2.5 !bg-violet-500 !border-2 !border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto !right-[-5px]"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-2.5 !h-2.5 !bg-violet-500 !border-2 !border-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto !left-[-5px]"
        />
      </div>

      {/* Column Mapping Modal */}
      {showMappingModal && hasData && (
        <ColumnMappingModal
          columns={columns}
          chartType={cellData.chartType}
          onSave={handleMappingSave}
          onClose={() => setShowMappingModal(false)}
        />
      )}
    </>
  );
}

export default memo(ChartCell);
