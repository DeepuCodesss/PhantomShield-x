import React from 'react';
import { cn } from '@/lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  ShieldAlert, 
  Activity, 
  Zap, 
  Lock, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { Threat, ActivityLog } from '@/types';

const data = [
  { name: '00:00', threats: 12, traffic: 400 },
  { name: '04:00', threats: 18, traffic: 300 },
  { name: '08:00', threats: 45, traffic: 900 },
  { name: '12:00', threats: 32, traffic: 800 },
  { name: '16:00', threats: 25, traffic: 600 },
  { name: '20:00', threats: 50, traffic: 1100 },
  { name: '23:59', threats: 38, traffic: 950 },
];

interface OverviewProps {
  threats: Threat[];
  logs: ActivityLog[];
  onReset: () => void;
  onOpenNotifications: () => void;
}

export const Overview: React.FC<OverviewProps> = ({ threats, logs, onReset, onOpenNotifications }) => {
  const activeThreatsCount = threats.filter(t => t.status === 'active').length;
  const criticalThreatsCount = threats.filter(t => t.severity === 'critical').length;
  
  const severityData = [
    { name: 'Critical', value: threats.filter(t => t.severity === 'critical').length, color: '#ef4444' },
    { name: 'High', value: threats.filter(t => t.severity === 'high').length, color: '#f97316' },
    { name: 'Medium', value: threats.filter(t => t.severity === 'medium').length, color: '#eab308' },
    { name: 'Low', value: threats.filter(t => t.severity === 'low').length, color: '#06b6d4' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Security Overview</h2>
          <p className="text-muted-foreground">Real-time monitoring and system health metrics.</p>
        </div>
        <button 
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 glass border-white/10 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 rounded-lg text-sm font-medium transition-all"
        >
          <ShieldAlert className="w-4 h-4" />
          Reset Dashboard Data
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Threats', value: activeThreatsCount.toString(), icon: ShieldAlert, color: 'text-red-500', trend: '+2', up: true, onClick: onOpenNotifications },
          { label: 'System Health', value: '98.2%', icon: Activity, color: 'text-emerald-500', trend: '+0.5%', up: true },
          { label: 'Network Load', value: '450MB/s', icon: Zap, color: 'text-primary', trend: '-12%', up: false },
          { label: 'Privacy Score', value: '94', icon: Lock, color: 'text-purple-500', trend: '+4', up: true },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={stat.onClick}
            className={cn(stat.onClick && "cursor-pointer")}
          >
            <Card className="glass border-white/5 hover:border-primary/20 transition-all group">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={cn("p-2 rounded-lg bg-white/5", stat.color)}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className={cn(
                    "flex items-center text-[10px] font-bold px-2 py-1 rounded-full bg-white/5",
                    stat.up ? "text-emerald-500" : "text-red-500"
                  )}>
                    {stat.up ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                    {stat.trend}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 glass border-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Threat Activity vs Network Traffic</CardTitle>
            <Badge variant="outline" className="font-mono text-[10px]">REAL-TIME FEED</Badge>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-neon-cyan)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-neon-cyan)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-neon-purple)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-neon-purple)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10,10,10,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="threats" 
                  stroke="var(--color-neon-cyan)" 
                  fillOpacity={1} 
                  fill="url(#colorThreats)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="traffic" 
                  stroke="var(--color-neon-purple)" 
                  fillOpacity={1} 
                  fill="url(#colorTraffic)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass border-white/5">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Threat Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="rgba(255,255,255,0.5)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'rgba(10,10,10,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            
            <div className="mt-6 space-y-3">
              {severityData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm font-mono font-bold">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
