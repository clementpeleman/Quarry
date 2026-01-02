import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/canvas"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to Canvas
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        
        <div className="space-y-6">
          {/* General Settings */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">General</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-zinc-400">Choose your preferred theme</p>
                </div>
                <select className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm">
                  <option value="dark">Dark</option>
                  <option value="light" disabled>Light (coming soon)</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-save</p>
                  <p className="text-sm text-zinc-400">Automatically save canvas changes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </section>
          
          {/* Editor Settings */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Editor</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Font Size</p>
                  <p className="text-sm text-zinc-400">SQL editor font size</p>
                </div>
                <select className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm">
                  <option value="12">12px</option>
                  <option value="13" selected>13px</option>
                  <option value="14">14px</option>
                  <option value="16">16px</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Word Wrap</p>
                  <p className="text-sm text-zinc-400">Wrap long lines in editor</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </section>
          
          {/* About */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">About</h2>
            <div className="space-y-2 text-sm text-zinc-400">
              <p><span className="text-white">Quarry</span> - Open Source Canvas BI Platform</p>
              <p>Version: 0.1.0</p>
              <p>License: AGPL-3.0</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
