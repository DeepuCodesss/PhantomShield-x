import React, { useState } from 'react';
import { 
  Zap, 
  Shield, 
  Settings, 
  Bug, 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  Trash2,
  Flag
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ScanType {
  id: string;
  name: string;
  description: string;
  icon: any;
  duration: string;
  color: string;
  severity: 'low' | 'medium' | 'high';
}

const scanTypes: ScanType[] = [
  {
    id: 'quick',
    name: 'Quick Scan',
    description: 'Scans critical system areas and active memory for immediate threats.',
    icon: Zap,
    duration: '2-5 mins',
    color: 'text-primary',
    severity: 'low'
  },
  {
    id: 'complete',
    name: 'Complete Scan',
    description: 'Deep analysis of all files, directories, and system configurations.',
    icon: Shield,
    duration: '30-60 mins',
    color: 'text-emerald-500',
    severity: 'high'
  },
  {
    id: 'custom',
    name: 'Custom Scan',
    description: 'Allows selection of specific folders or drives for targeted analysis.',
    icon: Settings,
    duration: 'Variable',
    color: 'text-purple-500',
    severity: 'medium'
  },
  {
    id: 'rootkit',
    name: 'Rootkit Scan',
    description: 'Detects stealthy malware designed to hide deep within the OS.',
    icon: Bug,
    duration: '15-20 mins',
    color: 'text-red-500',
    severity: 'high'
  }
];

export const ScanTypes: React.FC = () => {
  const [activeScan, setActiveScan] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [completedScans, setCompletedScans] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [infectedFiles, setInfectedFiles] = useState<string[]>([]);
  const [scanResultMode, setScanResultMode] = useState(false);

  const startScan = (id: string) => {
    if (activeScan) return;
    setActiveScan(id);
    setProgress(0);
    setCurrentFile('Initializing scan engines...');
    setIsModalOpen(true);
    setScanResultMode(false);
    setInfectedFiles([]);
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const eventSource = new EventSource(`${API_URL}/scan/system/${id}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.file === 'COMPLETE') {
          setProgress(100);
          setCurrentFile(`Final Decision: ${data.threats} threats neutralized.`);
          if (data.infected) {
              setInfectedFiles(data.infected);
          }
          setScanResultMode(true);
          eventSource.close();
          setCompletedScans(curr => Array.from(new Set([...curr, id])));
          setTimeout(() => {
            setActiveScan(null);
          }, 1000);
        } else {
          setProgress(data.progress || 0);
          setCurrentFile(data.file);
        }
      } catch (err) { }
    };

    eventSource.onerror = () => {
      setCurrentFile('Scan interrupted - System offline');
      eventSource.close();
      setTimeout(() => {
        setActiveScan(null);
        setCurrentFile(null);
      }, 3000);
    };
  };

  return (
    <Card className="glass border-white/5 overflow-hidden h-full">
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            System Scanning Operations
          </h3>
          <p className="text-xs text-muted-foreground">Execute specialized security audits across your infrastructure.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scanTypes.map((scan) => (
            <div 
              key={scan.id}
              className={cn(
                "relative p-4 rounded-xl border transition-all group",
                activeScan === scan.id ? "bg-primary/5 border-primary/30" : "glass border-white/5 hover:border-white/10"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={cn("p-2.5 rounded-lg bg-white/5", scan.color)}>
                    <scan.icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold">{scan.name}</h4>
                      {completedScans.includes(scan.id) && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-[250px]">{scan.description}</p>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" /> {scan.duration}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                        <AlertCircle className="w-3 h-3" /> {scan.severity} Impact
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  disabled={!!activeScan}
                  onClick={() => startScan(scan.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    activeScan === scan.id 
                      ? "bg-primary/20 text-primary cursor-default" 
                      : "bg-white/5 hover:bg-white/10 text-foreground disabled:opacity-50"
                  )}
                >
                  {activeScan === scan.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {progress}%
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      Start
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
         if (!open && !activeScan) {
             setIsModalOpen(false);
             setScanResultMode(false);
             setInfectedFiles([]);
         }
      }}>
        <DialogContent className="sm:max-w-4xl glass border-white/10 p-0 overflow-hidden bg-black/80 backdrop-blur-xl">
          <div className="p-6 pb-4 border-b border-white/5">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-3 font-mono">
                 <Shield className="w-6 h-6 text-primary" />
                 {scanResultMode ? "SCAN OPERATION COMPLETE" : "SYSTEM ANALYSIS IN PROGRESS"}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs opacity-70">
                 {scanResultMode ? "Review the detected anomalies and deploy remediation measures." : "Actively querying host registry and directory nodes for polymorphic malware signatures."}
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-6">
            {!scanResultMode ? (
               <div className="space-y-4">
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-primary transition-all duration-75 relative" style={{ width: `${progress}%` }}>
                        <div className="absolute top-0 bottom-0 left-0 right-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs font-mono text-primary/80 uppercase">
                      <span>Integrity: {progress}%</span>
                      <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Engine Active</span>
                  </div>
                  <div className="p-4 rounded-xl bg-black/60 border border-white/10 shadow-inner font-mono text-xs text-primary h-28 overflow-hidden break-all flex flex-col justify-end pointer-events-none">
                      <div className="opacity-50 blur-[0.5px] mb-1">{currentFile?.replace(/([^\\])$/, '$1...')}</div>
                      <div className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">Scanning: {currentFile}</div>
                  </div>
               </div>
            ) : (
               <div className="space-y-4">
                  {infectedFiles.length > 0 ? (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                         <h4 className="text-sm font-bold text-red-500 flex items-center gap-2 mb-4 font-mono">
                           <AlertCircle className="w-5 h-5 animate-pulse" /> CRITICAL: {infectedFiles.length} INFECTED NODES LOCATED
                         </h4>
                         {infectedFiles.map((file, idx) => (
                             <div key={idx} className="w-full p-3 rounded-lg bg-gradient-to-r from-red-500/10 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-red-500/20 group hover:border-red-500/50 transition-colors">
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="font-mono text-[10px] text-red-400/70 mb-1">MALWARE.EXPLOIT.HEURISTIC</span>
                                  <span className="font-mono text-xs text-red-100 break-all whitespace-normal leading-relaxed">{file}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <button onClick={() => setInfectedFiles(prev => prev.filter(f => f !== file))} className="px-3 py-1.5 flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded border border-emerald-500/20 transition-all font-mono text-[10px] font-bold whitespace-nowrap" title="Quarantine Payload"><Shield className="w-3 h-3 shrink-0" /> QUARANTINE</button>
                                    <button onClick={() => setInfectedFiles(prev => prev.filter(f => f !== file))} className="px-3 py-1.5 flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded border border-red-500/20 transition-all font-mono text-[10px] font-bold whitespace-nowrap" title="Delete Payload"><Trash2 className="w-3 h-3 shrink-0" /> DELETE</button>
                                </div>
                             </div>
                         ))}
                         {infectedFiles.length === 0 && (
                            <p className="text-emerald-500 text-sm font-mono mt-4">All threats successfully remediated.</p>
                         )}
                      </div>
                  ) : (
                      <div className="py-12 text-center flex items-center flex-col gap-4">
                         <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                         </div>
                         <h3 className="text-xl font-bold text-emerald-500 font-mono tracking-wider">SYSTEM SECURE</h3>
                         <p className="text-sm text-emerald-500/70 font-mono">No unauthorized rootkits or anomalous heuristics detected.</p>
                      </div>
                  )}
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
