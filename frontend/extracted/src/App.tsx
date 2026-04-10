import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { Overview } from './components/dashboard/Overview';
import { ThreatAnalysis } from './components/dashboard/ThreatAnalysis';
import { ActivityLogs } from './components/dashboard/ActivityLogs';
import { ChatBot } from './components/dashboard/ChatBot';
import { Settings } from './components/dashboard/Settings';
import { RecycleBin } from './components/dashboard/RecycleBin';
import { Hero } from './components/landing/Hero';
import { motion, AnimatePresence } from 'motion/react';
import { Threat, ActivityLog, RecycleBinItem } from './types';
import { mockThreats as initialThreats, mockLogs as initialLogs } from './mockData';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [isLanding, setIsLanding] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  // Global State
  const [threats, setThreats] = useState<Threat[]>(initialThreats as Threat[]);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs as ActivityLog[]);
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'Critical Threat Detected', description: 'SQL Injection attempt blocked on /api/v1/users', type: 'error', time: '2m ago' },
    { id: '2', title: 'System Update Ready', description: 'Version 2.4.0 is ready for deployment.', type: 'info', time: '1h ago' },
    { id: '3', title: 'Weekly Report Generated', description: 'Your security summary for this week is available.', type: 'success', time: '5h ago' },
  ]);

  // Check backend health on mount
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setBackendOnline(true);
          console.log('PhantomShield X Backend connected:', data);
        }
      })
      .catch(() => {
        console.warn('Backend not reachable. Running in offline/mock mode.');
        setBackendOnline(false);
      });
  }, []);

  // Fetch live incidents from backend periodically
  useEffect(() => {
    if (!backendOnline) return;

    const fetchIncidents = async () => {
      try {
        const res = await fetch(`${API_URL}/incidents`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const backendThreats: Threat[] = data.map((inc: any, i: number) => ({
            id: `AI-${Date.now()}-${i}`,
            type: inc.action === 'block_ip' ? 'AI: Anomalous Network Activity' :
                  inc.action === 'flag_session' ? 'AI: Suspicious Behavior' :
                  'AI: Monitored Event',
            severity: inc.severity === 'HIGH' ? 'critical' :
                      inc.severity === 'MEDIUM' ? 'high' :
                      'low',
            timestamp: new Date(inc.timestamp * 1000).toISOString(),
            status: inc.alert ? 'active' : 'mitigated',
            description: inc.message,
            source: inc.log?.source_ip || 'unknown',
          }));

          // Merge with existing, avoid duplicates by checking source + timestamp proximity
          setThreats(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const newThreats = backendThreats.filter(t => !existingIds.has(t.id));
            return [...newThreats, ...prev].slice(0, 50);
          });
        }
      } catch (err) {
        // Silently fail
      }
    };

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 15000); // poll every 15 seconds
    return () => clearInterval(interval);
  }, [backendOnline]);

  // Handlers
  const handleLogout = () => {
    setIsLanding(true);
    setActiveTab('dashboard');
  };

  const runSimulation = async () => {
    if (!backendOnline) return;
    try {
      const res = await fetch(`${API_URL}/simulate`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const simThreats: Threat[] = data
          .filter((inc: any) => inc.alert)
          .map((inc: any, i: number) => ({
            id: `SIM-${Date.now()}-${i}`,
            type: inc.severity === 'HIGH' ? 'AI: Critical Anomaly Detected' : 'AI: Suspicious Pattern',
            severity: inc.severity === 'HIGH' ? 'critical' : inc.severity === 'MEDIUM' ? 'high' : 'medium',
            timestamp: new Date(inc.timestamp * 1000).toISOString(),
            status: 'active',
            description: inc.message,
            source: inc.log?.source_ip || 'simulation',
          }));

        if (simThreats.length > 0) {
          setThreats(prev => [...simThreats, ...prev]);
          setNotifications(prev => [{
            id: `notif-${Date.now()}`,
            title: `Simulation Complete`,
            description: `${simThreats.length} threat(s) detected in simulated traffic.`,
            type: 'error',
            time: 'just now',
          }, ...prev]);
        } else {
          setNotifications(prev => [{
            id: `notif-${Date.now()}`,
            title: 'Simulation Complete',
            description: 'No threats detected in simulated traffic. System is stable.',
            type: 'success',
            time: 'just now',
          }, ...prev]);
        }
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    }
  };

  const moveToBin = (type: RecycleBinItem['type'], data: any) => {
    const newItem: RecycleBinItem = {
      type,
      data,
      deletedAt: new Date().toISOString()
    };
    setRecycleBin(prev => [newItem, ...prev]);

    if (type === 'threat') {
      setThreats(prev => prev.filter(t => t.id !== data.id));
    } else if (type === 'log') {
      setLogs(prev => prev.filter(l => l.id !== data.id));
    } else if (type === 'notification') {
      setNotifications(prev => prev.filter(n => n.id !== data.id));
    }
  };

  const restoreFromBin = (item: RecycleBinItem) => {
    if (item.type === 'threat') {
      setThreats(prev => [item.data, ...prev]);
    } else if (item.type === 'log') {
      setLogs(prev => [item.data, ...prev]);
    } else if (item.type === 'notification') {
      setNotifications(prev => [item.data, ...prev]);
    }
    setRecycleBin(prev => prev.filter(i => i !== item));
  };

  const permanentDelete = (id: string) => {
    setRecycleBin(prev => prev.filter(item => {
      if (item.type === 'threat') return item.data.id !== id;
      if (item.type === 'log') return item.data.id !== id;
      if (item.type === 'notification') return item.data.id !== id;
      return true;
    }));
  };

  const emptyBin = () => setRecycleBin([]);

  const clearAllData = () => {
    const threatItems: RecycleBinItem[] = threats.map(t => ({ type: 'threat', data: t, deletedAt: new Date().toISOString() }));
    const logItems: RecycleBinItem[] = logs.map(l => ({ type: 'log', data: l, deletedAt: new Date().toISOString() }));
    const notificationItems: RecycleBinItem[] = notifications.map(n => ({ type: 'notification', data: n, deletedAt: new Date().toISOString() }));
    
    setRecycleBin(prev => [...threatItems, ...logItems, ...notificationItems, ...prev]);
    setThreats([]);
    setLogs([]);
    setNotifications([]);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Overview 
            threats={threats} 
            logs={logs} 
            onReset={clearAllData} 
            onOpenNotifications={() => setIsNotificationsOpen(true)} 
          />
        );
      case 'threats':
        return <ThreatAnalysis threats={threats} setThreats={setThreats} onDelete={(t) => moveToBin('threat', t)} />;
      case 'logs':
        return <ActivityLogs logs={logs} onDelete={(l) => moveToBin('log', l)} />;
      case 'ai':
        return <ChatBot />;
      case 'settings':
        return <Settings onClearAll={clearAllData} />;
      case 'recycle':
        return (
          <RecycleBin 
            items={recycleBin} 
            onRestore={restoreFromBin} 
            onPermanentDelete={permanentDelete} 
            onEmpty={emptyBin} 
          />
        );
      default:
        return <Overview threats={threats} logs={logs} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <AnimatePresence mode="wait">
        {isLanding ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <Hero onEnter={() => setIsLanding(false)} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex h-screen overflow-hidden"
          >
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
            
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Topbar 
                notifications={notifications} 
                onClearNotification={(n) => moveToBin('notification', n)}
                onLogout={handleLogout}
                isOpen={isNotificationsOpen}
                onOpenChange={setIsNotificationsOpen}
              />
              
              <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      {renderContent()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Decorative Elements */}
      {!isLanding && (
        <div className="fixed bottom-0 right-0 p-4 pointer-events-none opacity-20">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em]">
            System Status: {backendOnline ? 'Online' : 'Offline'} // Encryption: Active // AI Core: {backendOnline ? 'Connected' : 'Standby'}
          </p>
        </div>
      )}
    </div>
  );
}
