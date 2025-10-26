/**
 * Darth Invader - Utility Functions
 * Seeded RNG, color helpers, and mathematical utilities
 */

// Seeded Random Number Generator (for deterministic simulations)
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
    this.originalSeed = seed;
  }

  reset() {
    this.seed = this.originalSeed;
  }

  setSeed(newSeed) {
    this.seed = newSeed;
    this.originalSeed = newSeed;
  }

  next() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  choice(array) {
    return array[this.int(0, array.length - 1)];
  }
}

// Color utilities
const Colors = {
  light: {
    background: '#ffffff',
    text: '#1f2937',
    server: '#3b82f6',
    client: '#10b981',
    attacker: '#ef4444',
    firewall: '#f59e0b',
    packetNormal: '#60a5fa',
    packetAttack: '#f87171',
    packetBlocked: '#34d399'
  },
  dark: {
    background: '#0f172a',
    text: '#f1f5f9',
    server: '#06b6d4',
    client: '#10b981',
    attacker: '#fb7185',
    firewall: '#fbbf24',
    packetNormal: '#22d3ee',
    packetAttack: '#f43f5e',
    packetBlocked: '#4ade80'
  },

  getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  },

  get(colorName) {
    const theme = this.getCurrentTheme();
    return this[theme][colorName] || '#ffffff';
  },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  },

  withAlpha(hex, alpha) {
    const rgb = this.hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }
};

// Mathematical helpers
const MathUtils = {
  lerp(start, end, t) {
    return start + (end - start) * t;
  },

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  },

  map(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  }
};

// Node class for network visualization
class Node {
  constructor(id, type, x, y, radius = 20) {
    this.id = id;
    this.type = type; // 'server', 'client', 'attacker', 'firewall'
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.connections = [];
  }

  draw(ctx, time) {
    const color = Colors.get(this.type);
    
    // Pulsing effect for attackers
    if (this.type === 'attacker') {
      const pulse = Math.sin(time * 0.005 + this.pulsePhase) * 0.3 + 1;
      const glowSize = this.radius * pulse;
      
      // Glow
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowSize);
      gradient.addColorStop(0, Colors.withAlpha(color, 0.4));
      gradient.addColorStop(1, Colors.withAlpha(color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(this.x - glowSize, this.y - glowSize, glowSize * 2, glowSize * 2);
    }
    
    // Node circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Border
    ctx.strokeStyle = Colors.withAlpha(color, 0.8);
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Type indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = `${this.radius}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const icons = {
      server: '🖥',
      client: '💻',
      attacker: '☠',
      firewall: '🛡'
    };
    
    ctx.fillText(icons[this.type] || '?', this.x, this.y);
  }
}

// Packet class for network traffic visualization
class Packet {
  constructor(id, source, target, type, speed = 2) {
    this.id = id;
    this.source = source;
    this.target = target;
    this.type = type; // 'normal', 'attack', 'blocked'
    this.speed = speed;
    this.progress = 0;
    this.x = source.x;
    this.y = source.y;
    this.active = true;
    this.trail = [];
  }

  update() {
    if (!this.active) return false;
    
    this.progress += this.speed * 0.01;
    
    if (this.progress >= 1) {
      this.active = false;
      return false;
    }
    
    // Smooth interpolation with slight curve
    const t = this.progress;
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    
    this.x = MathUtils.lerp(this.source.x, this.target.x, ease);
    this.y = MathUtils.lerp(this.source.y, this.target.y, ease);
    
    // Add to trail
    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 10) {
      this.trail.shift();
    }
    
    return true;
  }

  draw(ctx) {
    if (!this.active) return;
    
    const colorMap = {
      normal: 'packetNormal',
      attack: 'packetAttack',
      blocked: 'packetBlocked'
    };
    
    const color = Colors.get(colorMap[this.type]);
    
    // Draw trail
    this.trail.forEach((point, i) => {
      const alpha = (i / this.trail.length) * 0.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = Colors.withAlpha(color, alpha);
      ctx.fill();
    });
    
    // Draw packet
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 8);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, Colors.withAlpha(color, 0.2));
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// Performance monitor
class PerformanceMonitor {
  constructor() {
    this.frames = [];
    this.lastTime = performance.now();
  }

  update() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    
    this.frames.push(delta);
    if (this.frames.length > 60) {
      this.frames.shift();
    }
  }

  getFPS() {
    if (this.frames.length === 0) return 60;
    const avgDelta = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    return Math.round(1000 / avgDelta);
  }
}

// Export to global scope
window.SeededRandom = SeededRandom;
window.Colors = Colors;
window.MathUtils = MathUtils;
window.Node = Node;
window.Packet = Packet;
window.PerformanceMonitor = PerformanceMonitor;