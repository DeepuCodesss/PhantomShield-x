export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Threat {
  id: string;
  type: string;
  severity: Severity;
  timestamp: string;
  status: 'active' | 'mitigated' | 'ignored';
  description: string;
  source: string;
}

export interface ActivityLog {
  id: string;
  event: string;
  timestamp: string;
  user?: string;
  details: string;
  type: 'security' | 'system' | 'user';
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  network: number;
  uptime: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export type RecycleBinItem = 
  | { type: 'threat'; data: Threat; deletedAt: string }
  | { type: 'log'; data: ActivityLog; deletedAt: string }
  | { type: 'notification'; data: any; deletedAt: string };
