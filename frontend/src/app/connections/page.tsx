'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useConnections, Connection, ConnectionInput } from '@/lib/connections/store';

const CUBE_API_URL = process.env.NEXT_PUBLIC_CUBE_API_URL || 'http://localhost:4545';

export default function ConnectionsPage() {
  const {
    connections,
    activeConnection,
    isLoading,
    error,
    fetchConnections,
    createConnection,
    deleteConnection,
    testConnection,
    activateConnection,
  } = useConnections();

  const [showAddModal, setShowAddModal] = useState(false);
  const [cubeStatus, setCubeStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  // Check Cube.js connection status
  useEffect(() => {
    const checkCubeStatus = async () => {
      try {
        const res = await fetch(`${CUBE_API_URL}/cubejs-api/v1/meta`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          setCubeStatus('connected');
        } else {
          setCubeStatus('error');
        }
      } catch {
        setCubeStatus('error');
      }
    };
    checkCubeStatus();
  }, []);

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testConnection(id);
      setTestResults(prev => ({ ...prev, [id]: result }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, error: err.message } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (confirm('Are you sure you want to delete this connection?')) {
      try {
        await deleteConnection(id);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleActivateConnection = async (id: string) => {
    try {
      await activateConnection(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddConnection = async (input: ConnectionInput) => {
    try {
      await createConnection(input);
      setShowAddModal(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusBadge = (conn: Connection) => {
    const testResult = testResults[conn.id];

    if (testResult) {
      if (testResult.success) {
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Connected
          </span>
        );
      } else {
        return (
          <span className="flex items-center gap-1 text-xs text-red-400" title={testResult.error}>
            <span className="w-2 h-2 bg-red-400 rounded-full" />
            Error
          </span>
        );
      }
    }

    if (conn.is_active) {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Active
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-xs text-zinc-500">
        <span className="w-2 h-2 bg-zinc-500 rounded-full" />
        Inactive
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/canvas" className="text-zinc-400 hover:text-white transition-colors text-sm mb-4 inline-block">
            ← Back to Canvas
          </Link>
          <h1 className="text-3xl font-bold mb-2">Data Connections</h1>
          <p className="text-zinc-400">Manage your PostgreSQL database connections</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
            <button onClick={() => fetchConnections()} className="text-sm text-red-300 underline mt-2">
              Retry
            </button>
          </div>
        )}

        {/* Cube.js Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Cube.js Semantic Layer</h3>
                <p className="text-sm text-zinc-400">
                  {cubeStatus === 'connected' && 'Running on localhost:4545'}
                  {cubeStatus === 'error' && 'Not connected'}
                  {cubeStatus === 'loading' && 'Checking connection...'}
                </p>
              </div>
            </div>
            <div>
              {cubeStatus === 'connected' ? (
                <span className="flex items-center gap-2 text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Active
                </span>
              ) : cubeStatus === 'error' ? (
                <span className="flex items-center gap-2 text-red-400">
                  <span className="w-2 h-2 bg-red-400 rounded-full" />
                  Offline
                </span>
              ) : (
                <span className="text-zinc-500">Loading...</span>
              )}
            </div>
          </div>
        </div>

        {/* Connections List */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">PostgreSQL Connections</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Connection
            </button>
          </div>

          <div className="space-y-3">
            {connections.map(conn => (
              <div
                key={conn.id}
                className={`bg-zinc-900 border rounded-lg p-4 transition-colors ${
                  conn.is_active ? 'border-indigo-500/50 bg-indigo-950/10' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-2xl mt-1">🐘</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{conn.name}</h3>
                        {conn.is_demo && (
                          <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                            Demo
                          </span>
                        )}
                        {getStatusBadge(conn)}
                      </div>
                      <div className="text-sm text-zinc-400 space-y-1">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <span className="text-zinc-600">Host:</span>
                            {conn.host}:{conn.port}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-zinc-600">Database:</span>
                            {conn.database_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-zinc-600">User:</span>
                            {conn.username}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!conn.is_active && (
                      <button
                        onClick={() => handleActivateConnection(conn.id)}
                        className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      onClick={() => handleTestConnection(conn.id)}
                      disabled={testingId === conn.id}
                      className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded transition-colors disabled:opacity-50"
                    >
                      {testingId === conn.id ? 'Testing...' : 'Test'}
                    </button>
                    {!conn.is_demo && (
                      <button
                        onClick={() => handleDeleteConnection(conn.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete connection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {connections.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <svg className="w-16 h-16 text-zinc-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <h3 className="text-lg font-medium text-zinc-400 mb-2">No connections yet</h3>
              <p className="text-sm text-zinc-600 mb-4">Add your first database connection to get started</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Add Connection
              </button>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">About Database Connections</p>
              <p className="text-blue-300/80">
                The <strong>active connection</strong> is used for schema introspection and semantic layer queries.
                Define your data model, metrics, and relationships in the <Link href="/model" className="underline hover:text-blue-200">Model</Link> page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Connection Modal */}
      {showAddModal && (
        <AddConnectionModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddConnection}
        />
      )}
    </div>
  );
}

function AddConnectionModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: ConnectionInput) => void;
}) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database_name, setDatabaseName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (name && host && database_name && username) {
      setIsSaving(true);
      try {
        await onSave({
          name,
          host,
          port: parseInt(port) || 5432,
          database_name,
          username,
          password: password || undefined,
          ssl,
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-[600px] max-w-full max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900">
          <h3 className="text-xl font-semibold">Add PostgreSQL Connection</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Connection Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Production Database"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-2">Host *</label>
              <input
                type="text"
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="localhost or 192.168.1.100"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Port</label>
              <input
                type="text"
                value={port}
                onChange={e => setPort(e.target.value)}
                placeholder="5432"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Database Name *</label>
            <input
              type="text"
              value={database_name}
              onChange={e => setDatabaseName(e.target.value)}
              placeholder="mydb"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Username *</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="postgres"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ssl"
              checked={ssl}
              onChange={e => setSsl(e.target.checked)}
              className="w-4 h-4 bg-zinc-800 border border-zinc-700 rounded"
            />
            <label htmlFor="ssl" className="text-sm text-zinc-400">
              Use SSL connection
            </label>
          </div>

          <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-amber-300/90">
                Connection credentials are encrypted and stored securely. Make sure your database is accessible from this machine.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3 sticky bottom-0 bg-zinc-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !host || !database_name || !username || isSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Adding...' : 'Add Connection'}
          </button>
        </div>
      </div>
    </div>
  );
}
