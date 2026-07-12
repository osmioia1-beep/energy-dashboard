import { Dashboard } from './components/Dashboard';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Energy Monitor</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                Vila Nova de Famalicão
              </span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online"></div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;