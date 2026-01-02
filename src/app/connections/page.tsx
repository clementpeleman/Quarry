import Link from 'next/link';

export default function ConnectionsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/canvas"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ← Canvas
          </Link>
          <h1 className="text-xl font-semibold">Connections & Schema</h1>
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sidebar - Data Sources */}
        <div className="w-64 border-r border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Data Sources</h2>
          
          <div className="space-y-1">
            <button className="w-full text-left px-3 py-2 rounded bg-zinc-800 text-white text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              DuckDB (In-Browser)
            </button>
          </div>

          <div className="mt-6">
            <button className="w-full px-3 py-2 border border-dashed border-zinc-700 rounded text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors">
              + Add Connection
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Schema Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Schema</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Table Cards */}
              {['customers', 'products', 'orders'].map(table => (
                <div key={table} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-white capitalize">{table}</h3>
                    <button className="text-xs text-zinc-500 hover:text-white">Edit</button>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">Sample {table} data</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>id</span>
                      <span className="text-blue-400">INTEGER</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>name</span>
                      <span className="text-green-400">VARCHAR</span>
                    </div>
                    <div className="text-zinc-600">+ more columns...</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Semantic Layer Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Semantic Layer</h2>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">Coming Soon</span>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
              <svg className="w-12 h-12 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <p className="text-zinc-500 text-sm mb-2">Define metrics, dimensions, and relationships</p>
              <p className="text-zinc-600 text-xs">Add business context to your data model</p>
            </div>
          </div>

          {/* Relationships Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Relationships</h2>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">Coming Soon</span>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
              <svg className="w-12 h-12 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-zinc-500 text-sm mb-2">Define how tables relate to each other</p>
              <p className="text-zinc-600 text-xs">Enable automatic JOINs in your queries</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
