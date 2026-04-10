import React from 'react';
import { Shield, Lock, Zap, ChevronRight, Play, Globe, Cpu } from 'lucide-react';
import { motion } from 'motion/react';

interface HeroProps {
  onEnter: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onEnter }) => {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#050505]">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
        
        {/* Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-8"
        >
          <Zap className="w-3 h-3 fill-current" />
          Next-Gen AI Protection
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-6xl md:text-8xl font-bold tracking-tighter mb-6"
        >
          Secure Your Digital <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-purple-500">
            PhantomShieldX
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          PhantomShieldX uses advanced neural monitoring and real-time threat prediction to keep your systems invisible to attackers.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button 
            onClick={onEnter}
            className="group relative px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 neon-glow-cyan"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative flex items-center gap-2">
              Launch Control Center
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
          
          <button className="px-8 py-4 glass border-white/10 hover:bg-white/5 font-bold rounded-xl transition-all flex items-center gap-2">
            <Play className="w-5 h-5 fill-current" />
            Watch Demo
          </button>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto"
        >
          {[
            { icon: Globe, title: 'Global Monitoring', desc: 'Real-time analysis of 100+ global data centers.' },
            { icon: Cpu, title: 'Neural Engine', desc: 'Self-learning AI that adapts to new threat vectors.' },
            { icon: Lock, title: 'Quantum Privacy', desc: 'End-to-end encryption resistant to future computing.' },
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-2xl glass border-white/5 text-left hover:border-primary/20 transition-all group">
              <feature.icon className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Decorative Scanning Effect */}
      <div className="scanline" />
    </div>
  );
};
