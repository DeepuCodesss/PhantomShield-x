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

export default function App() {
  const [isLanding, setIsLanding] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  // Global State
  const [threats, setThreats] = useState<Threat[]>(initialThreats as Threat[]);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs as ActivityLog[]);
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>([]);
  
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_URL}/incidents`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data && data.length > 0) {
          const liveThreats = data.map((inc: any, i: number) => {
            const isSystemMetric = inc.log.action === 'system_metric';
            const isAnomalous = isSystemMetric && (inc.severity === 'HIGH' || inc.severity === 'CRITICAL');
            
            let finalSeverity = inc.severity.toLowerCase();
            if (isSystemMetric) {
               // Hard override: Background PC telemetry defaults directly to SAFE (Green)
               // Only trigger an actual system metric anomaly if the AI is 95+ severity indicating terminal malfunction.
               if (inc.risk_score >= 95) {
                   finalSeverity = 'critical';
               } else {
                   finalSeverity = 'low';
               }
            }

            return {
              id: `live-${inc.timestamp}-${i}`,
              type: isSystemMetric 
                ? (isAnomalous ? 'System Anomaly Detected' : 'System Status Safe') 
                : (inc.severity === 'LOW' ? 'Network Activity' : 'Network Incident'),
              severity: finalSeverity,
              source: inc.log.source_ip || 'unknown',
              status: 'active',
              timestamp: inc.log.datetime || new Date().toISOString(),
              description: isSystemMetric 
                ? `Host Metrics - CPU: ${inc.log.cpu_usage}%, RAM: ${inc.log.memory_usage}%. Protocol: ${inc.log.protocol} on Port: ${inc.log.port}`
                : inc.message
            };
          });
          
          setThreats(liveThreats);
        }
      } catch (err) {
        console.error("Live monitoring offline", err);
      }
    };
    
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, []);
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'Critical Threat Detected', description: 'SQL Injection attempt blocked on /api/v1/users', type: 'error', time: '2m ago' },
    { id: '2', title: 'System Update Ready', description: 'Version 2.4.0 is ready for deployment.', type: 'info', time: '1h ago' },
    { id: '3', title: 'Weekly Report Generated', description: 'Your security summary for this week is available.', type: 'success', time: '5h ago' },
  ]);

  // Handlers
  const handleLogout = () => {
    setIsLanding(true);
    setActiveTab('dashboard');
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
            System Status: Nominal // Encryption: Active // AI Core: Online
          </p>
        </div>
      )}
    </div>
  );
}
