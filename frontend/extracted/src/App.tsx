import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { Overview } from './components/dashboard/Overview';
import { ThreatAnalysis } from './components/dashboard/ThreatAnalysis';
import { ActivityLogs } from './components/dashboard/ActivityLogs';
import { ChatBot } from './components/dashboard/ChatBot';
import { Settings } from './components/dashboard/Settings';
import { RecycleBin } from './components/dashboard/RecycleBin';
import { AdminPanel } from './components/dashboard/AdminPanel';
import { Hero } from './components/landing/Hero';
import { Login } from './components/landing/Login';
import { SignUp } from './components/landing/SignUp';
import { motion, AnimatePresence } from 'motion/react';
import { Threat, ActivityLog, RecycleBinItem } from './types';
import { mockThreats as initialThreats, mockLogs as initialLogs } from './mockData';

export default function App() {
  const [view, setView] = useState<'hero' | 'login' | 'signup' | 'dashboard'>('hero');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState<{email: string; password: string}[]>([
    { email: 'mayankraj@gmail.com', password: '1234' }
  ]);
  
  // Global State
  const [threats, setThreats] = useState<Threat[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
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
            
            let finalSeverity = inc.severity.toLowerCase();
            if (isSystemMetric) {
               // Only flag system metrics as threats if risk score is extreme
               if (inc.risk_score >= 95) {
                   finalSeverity = 'critical';
               } else {
                   finalSeverity = 'low';
               }
            }

            // Real status: only high/critical severity = active threat. Everything else = resolved/safe.
            const isRealThreat = (finalSeverity === 'critical' || finalSeverity === 'high');

            return {
              id: `live-${inc.timestamp}-${i}`,
              type: isSystemMetric 
                ? (isRealThreat ? 'System Anomaly Detected' : 'System Status Safe') 
                : (isRealThreat ? 'Network Incident' : 'Network Activity'),
              severity: finalSeverity,
              source: inc.log.source_ip || 'unknown',
              status: isRealThreat ? 'active' : 'resolved',
              timestamp: inc.log.datetime || new Date().toISOString(),
              description: isSystemMetric 
                ? `Host Metrics - CPU: ${inc.log.cpu_usage}%, RAM: ${inc.log.memory_usage}%. Protocol: ${inc.log.protocol} on Port: ${inc.log.port}`
                : inc.message
            };
          });
          
          setThreats(liveThreats);
          
          // Build real activity logs from incidents
          const liveLogs: ActivityLog[] = data.map((inc: any, i: number) => {
            const isSystemMetric = inc.log.action === 'system_metric';
            const sev = inc.severity?.toUpperCase() || 'LOW';
            
            let logType: 'system' | 'security' | 'user' = 'system';
            let event = 'System Telemetry';
            let details = '';
            
            if (isSystemMetric) {
              logType = 'system';
              event = `System Monitor — CPU ${inc.log.cpu_usage}%, RAM ${inc.log.memory_usage}%`;
              details = `Protocol: ${inc.log.protocol} | Port: ${inc.log.port} | Target: ${inc.log.source_ip}`;
            } else if (sev === 'CRITICAL' || sev === 'HIGH') {
              logType = 'security';
              event = `Security Alert: ${inc.action || 'Anomaly Detected'}`;
              details = inc.message || `Risk Score: ${inc.risk_score} | Source: ${inc.log.source_ip}`;
            } else {
              logType = 'user';
              event = `Network Activity — ${inc.log.protocol || 'TCP'}`;
              details = inc.message || `${inc.log.source_ip} → ${inc.log.dest_ip}:${inc.log.port}`;
            }
            
            return {
              id: `log-${inc.timestamp}-${i}`,
              event,
              timestamp: inc.log.datetime || new Date().toISOString(),
              details,
              type: logType,
              user: isSystemMetric ? 'HOST-SYSTEM' : (inc.log.user_id || undefined),
            };
          });
          
          setLogs(liveLogs);
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
    setView('hero');
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
            loggedInEmail={loggedInEmail}
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
      case 'admin':
        return <AdminPanel />;
      default:
        return <Overview threats={threats} logs={logs} onReset={clearAllData} onOpenNotifications={() => setIsNotificationsOpen(true)} loggedInEmail={loggedInEmail} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <AnimatePresence mode="wait">
        {view === 'hero' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Hero onEnter={() => setView('login')} />
          </motion.div>
        ) : view === 'login' ? (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Login onLogin={(email: string) => {
              setLoggedInEmail(email);
              // Add real login log entry
              setLogs(prev => [{
                id: `login-${Date.now()}`,
                event: `User Login — ${email}`,
                timestamp: new Date().toISOString(),
                details: `Successful authentication from ${email}. Session initiated.`,
                type: 'user' as const,
                user: email,
              }, ...prev]);
              setView('dashboard');
            }} onSignUp={() => setView('signup')} registeredUsers={registeredUsers} />
          </motion.div>
        ) : view === 'signup' ? (
          <motion.div
            key="signup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SignUp onSignIn={() => setView('login')} onSignUpComplete={(user) => {
               setRegisteredUsers(prev => [...prev, user]);
               setView('login');
            }} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex h-screen overflow-hidden"
          >
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} isAdmin={loggedInEmail === 'mayankraj@gmail.com'} />
            
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
      {view === 'dashboard' && (
        <div className="fixed bottom-0 right-0 p-4 pointer-events-none opacity-20">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em]">
            System Status: Nominal // Encryption: Active // AI Core: Online
          </p>
        </div>
      )}
    </div>
  );
}
