/**
 * Darth Invader - Attack Simulation Engine
 * Contains all attack scenario logic and implementations
 */

// Attack Scenario Definitions
const SCENARIOS = {
  ddos: {
    name: 'DDoS Attack',
    description: 'Distributed Denial of Service - Multiple attackers flood server',
    attackers: 30,
    packetsPerSecond: 100,
    duration: 60,
    nodeLayout: {
      server: { x: 400, y: 300, radius: 40 },
      attackers: 'distributed-circle'
    }
  },
  mitm: {
    name: 'Man-in-the-Middle',
    description: 'Attacker intercepts communication between two parties',
    attackers: 1,
    clients: 2,
    packetsPerSecond: 20,
    nodeLayout: {
      client1: { x: 200, y: 300 },
      attacker: { x: 400, y: 300 },
      client2: { x: 600, y: 300 }
    }
  },
  firewall: {
    name: 'Firewall Defense',
    description: 'Firewall filters malicious traffic',
    attackers: 10,
    legitimateClients: 5,
    packetsPerSecond: 50,
    blockRate: 0.8,
    nodeLayout: {
      server: { x: 600, y: 300 },
      firewall: { x: 400, y: 300 },
      nodes: 'left-side-distributed'
    }
  },
  arpSpoof: {
    name: 'ARP Spoofing',
    description: 'Attacker poisons ARP cache to intercept traffic',
    nodes: 8,
    attacker: 1,
    packetsPerSecond: 30,
    nodeLayout: {
      type: 'local-network-grid'
    }
  }
};

// Base Attack Simulation Class
class AttackSimulation {
  constructor(scenario, rng, canvasWidth, canvasHeight) {
    this.scenario = scenario;
    this.rng = rng;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.nodes = [];
    this.packets = [];
    this.metrics = {
      packetsSent: 0,
      packetsReceived: 0,
      packetsDropped: 0,
      packetsBlocked: 0,
      serverLoad: 0,
      latency: 0
    };
    this.time = 0;
    this.packetIdCounter = 0;
  }

  initialize() {
    // Override in subclasses
  }

  update(deltaTime, speed, intensity) {
    this.time += deltaTime * speed;
    
    // Update packets
    this.packets = this.packets.filter(packet => packet.update());
    
    // Generate new packets based on scenario
    this.generatePackets(intensity);
    
    // Update metrics
    this.updateMetrics();
  }

  generatePackets(intensity) {
    // Override in subclasses
  }

  updateMetrics() {
    // Override in subclasses
  }

  render(ctx) {
    // Draw connections
    this.renderConnections(ctx);
    
    // Draw nodes
    this.nodes.forEach(node => node.draw(ctx, this.time));
    
    // Draw packets
    this.packets.forEach(packet => packet.draw(ctx));
  }

  renderConnections(ctx) {
    ctx.strokeStyle = Colors.withAlpha(Colors.get('text'), 0.1);
    ctx.lineWidth = 1;
    
    this.nodes.forEach(node => {
      node.connections.forEach(targetId => {
        const target = this.nodes.find(n => n.id === targetId);
        if (target) {
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });
    });
  }

  createPacket(source, target, type, speed) {
    const packet = new Packet(
      this.packetIdCounter++,
      source,
      target,
      type,
      speed
    );
    this.packets.push(packet);
    this.metrics.packetsSent++;
    return packet;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// DDoS Attack Simulation
class DDoSAttack extends AttackSimulation {
  initialize() {
    // Create server in center
    const serverNode = new Node(
      'server',
      'server',
      this.canvasWidth / 2,
      this.canvasHeight / 2,
      40
    );
    this.nodes.push(serverNode);
    
    // Create attacker nodes in a circle
    const attackerCount = this.scenario.attackers;
    const radius = Math.min(this.canvasWidth, this.canvasHeight) * 0.35;
    
    for (let i = 0; i < attackerCount; i++) {
      const angle = (i / attackerCount) * Math.PI * 2;
      const x = this.canvasWidth / 2 + Math.cos(angle) * radius;
      const y = this.canvasHeight / 2 + Math.sin(angle) * radius;
      
      const attacker = new Node(`attacker-${i}`, 'attacker', x, y, 15);
      attacker.connections.push('server');
      this.nodes.push(attacker);
    }
  }

  generatePackets(intensity) {
    const serverNode = this.nodes.find(n => n.id === 'server');
    const attackers = this.nodes.filter(n => n.type === 'attacker');
    
    // Generate attack packets based on intensity
    const packetsThisFrame = (intensity / 100) * this.scenario.packetsPerSecond * 0.016; // 60fps
    
    for (let i = 0; i < packetsThisFrame; i++) {
      if (this.rng.next() < 0.5) {
        const attacker = this.rng.choice(attackers);
        this.createPacket(attacker, serverNode, 'attack', 2);
      }
    }
  }

  updateMetrics() {
    const activePackets = this.packets.filter(p => p.active).length;
    this.metrics.serverLoad = Math.min(100, (activePackets / 50) * 100);
    
    // Calculate latency based on load
    this.metrics.latency = Math.floor(10 + (this.metrics.serverLoad / 100) * 500);
    
    // Some packets get dropped when overloaded
    if (this.metrics.serverLoad > 80) {
      this.packets.forEach(packet => {
        if (packet.active && packet.progress > 0.9 && this.rng.next() < 0.3) {
          packet.active = false;
          this.metrics.packetsDropped++;
        }
      });
    } else {
      // Packets arrive at server
      this.packets.forEach(packet => {
        if (!packet.active && packet.progress >= 1) {
          this.metrics.packetsReceived++;
        }
      });
    }
  }
}

// MITM Attack Simulation
class MITMAttack extends AttackSimulation {
  initialize() {
    // Create two clients
    const client1 = new Node('client1', 'client', this.canvasWidth * 0.25, this.canvasHeight / 2, 25);
    const client2 = new Node('client2', 'client', this.canvasWidth * 0.75, this.canvasHeight / 2, 25);
    
    // Create attacker in the middle
    const attacker = new Node('attacker', 'attacker', this.canvasWidth / 2, this.canvasHeight / 2, 30);
    
    // Set up connections
    client1.connections.push('attacker');
    attacker.connections.push('client1', 'client2');
    client2.connections.push('attacker');
    
    this.nodes.push(client1, attacker, client2);
  }

  generatePackets(intensity) {
    const client1 = this.nodes.find(n => n.id === 'client1');
    const client2 = this.nodes.find(n => n.id === 'client2');
    const attacker = this.nodes.find(n => n.id === 'attacker');
    
    const packetsThisFrame = (intensity / 100) * this.scenario.packetsPerSecond * 0.016;
    
    for (let i = 0; i < packetsThisFrame; i++) {
      if (this.rng.next() < 0.5) {
        // Client 1 to Client 2 (through attacker)
        if (this.rng.next() < 0.5) {
          this.createPacket(client1, attacker, 'normal', 1.5);
          // Attacker forwards to client2 after a delay
          setTimeout(() => {
            if (attacker && client2) {
              this.createPacket(attacker, client2, 'attack', 1.5);
            }
          }, 500);
        } else {
          // Client 2 to Client 1 (through attacker)
          this.createPacket(client2, attacker, 'normal', 1.5);
          setTimeout(() => {
            if (attacker && client1) {
              this.createPacket(attacker, client1, 'attack', 1.5);
            }
          }, 500);
        }
      }
    }
  }

  updateMetrics() {
    const activePackets = this.packets.filter(p => p.active).length;
    this.metrics.serverLoad = Math.min(100, (activePackets / 20) * 100);
    this.metrics.latency = Math.floor(150 + this.rng.range(0, 100));
    
    this.packets.forEach(packet => {
      if (!packet.active && packet.progress >= 1) {
        this.metrics.packetsReceived++;
      }
    });
  }
}

// Firewall Defense Simulation
class FirewallAttack extends AttackSimulation {
  initialize() {
    // Create server on the right
    const server = new Node('server', 'server', this.canvasWidth * 0.75, this.canvasHeight / 2, 35);
    
    // Create firewall in the middle
    const firewall = new Node('firewall', 'firewall', this.canvasWidth / 2, this.canvasHeight / 2, 30);
    firewall.connections.push('server');
    
    this.nodes.push(server, firewall);
    
    // Create mix of attackers and legitimate clients on the left
    const totalNodes = this.scenario.attackers + this.scenario.legitimateClients;
    
    for (let i = 0; i < totalNodes; i++) {
      const isAttacker = i < this.scenario.attackers;
      const x = this.canvasWidth * 0.15 + this.rng.range(-50, 50);
      const y = (i / totalNodes) * this.canvasHeight * 0.8 + this.canvasHeight * 0.1;
      
      const node = new Node(
        `node-${i}`,
        isAttacker ? 'attacker' : 'client',
        x,
        y,
        15
      );
      node.connections.push('firewall');
      this.nodes.push(node);
    }
  }

  generatePackets(intensity) {
    const firewall = this.nodes.find(n => n.id === 'firewall');
    const server = this.nodes.find(n => n.id === 'server');
    const clients = this.nodes.filter(n => n.type === 'client' || n.type === 'attacker');
    
    const packetsThisFrame = (intensity / 100) * this.scenario.packetsPerSecond * 0.016;
    
    for (let i = 0; i < packetsThisFrame; i++) {
      if (this.rng.next() < 0.5) {
        const client = this.rng.choice(clients);
        const isAttack = client.type === 'attacker';
        const packetType = isAttack ? 'attack' : 'normal';
        
        // Send to firewall first
        const packet = this.createPacket(client, firewall, packetType, 1.5);
        
        // Firewall decides whether to block or forward
        setTimeout(() => {
          if (isAttack && this.rng.next() < this.scenario.blockRate) {
            // Block attack packet
            packet.type = 'blocked';
            packet.active = false;
            this.metrics.packetsBlocked++;
          } else {
            // Forward to server
            if (firewall && server) {
              this.createPacket(firewall, server, packetType, 1.5);
            }
          }
        }, 500);
      }
    }
  }

  updateMetrics() {
    const activePackets = this.packets.filter(p => p.active).length;
    this.metrics.serverLoad = Math.min(100, (activePackets / 30) * 100);
    this.metrics.latency = Math.floor(50 + (this.metrics.serverLoad / 100) * 200);
    
    this.packets.forEach(packet => {
      if (!packet.active && packet.progress >= 1 && packet.type !== 'blocked') {
        this.metrics.packetsReceived++;
      }
    });
  }
}

// ARP Spoofing Simulation
class ARPSpoofAttack extends AttackSimulation {
  initialize() {
    // Create network nodes in a grid
    const gridSize = Math.ceil(Math.sqrt(this.scenario.nodes));
    const spacing = Math.min(this.canvasWidth, this.canvasHeight) * 0.7 / gridSize;
    const offsetX = (this.canvasWidth - spacing * gridSize) / 2;
    const offsetY = (this.canvasHeight - spacing * gridSize) / 2;
    
    for (let i = 0; i < this.scenario.nodes; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      const x = offsetX + col * spacing + spacing / 2;
      const y = offsetY + row * spacing + spacing / 2;
      
      const node = new Node(`node-${i}`, 'client', x, y, 20);
      this.nodes.push(node);
    }
    
    // Create attacker node
    const attacker = new Node(
      'attacker',
      'attacker',
      this.canvasWidth / 2,
      this.canvasHeight / 2,
      25
    );
    this.nodes.push(attacker);
    
    // Set up connections (mesh network)
    this.nodes.forEach(node => {
      if (node.type !== 'attacker') {
        node.connections.push('attacker');
      }
    });
  }

  generatePackets(intensity) {
    const attacker = this.nodes.find(n => n.id === 'attacker');
    const clients = this.nodes.filter(n => n.type === 'client');
    
    const packetsThisFrame = (intensity / 100) * this.scenario.packetsPerSecond * 0.016;
    
    for (let i = 0; i < packetsThisFrame; i++) {
      if (this.rng.next() < 0.3) {
        // Normal traffic between nodes
        const source = this.rng.choice(clients);
        const target = this.rng.choice(clients.filter(c => c.id !== source.id));
        
        if (target) {
          // Traffic gets rerouted through attacker
          this.createPacket(source, attacker, 'normal', 1);
          setTimeout(() => {
            if (attacker && target) {
              this.createPacket(attacker, target, 'attack', 1);
            }
          }, 400);
        }
      } else if (this.rng.next() < 0.5) {
        // ARP spoof packets from attacker
        const target = this.rng.choice(clients);
        this.createPacket(attacker, target, 'attack', 2);
      }
    }
  }

  updateMetrics() {
    const activePackets = this.packets.filter(p => p.active).length;
    this.metrics.serverLoad = Math.min(100, (activePackets / 40) * 100);
    this.metrics.latency = Math.floor(30 + this.rng.range(0, 100));
    
    this.packets.forEach(packet => {
      if (!packet.active && packet.progress >= 1) {
        this.metrics.packetsReceived++;
      }
    });
  }
}

// Simulation Factory
class SimulationFactory {
  static create(scenarioName, rng, canvasWidth, canvasHeight) {
    const scenario = SCENARIOS[scenarioName];
    if (!scenario) {
      console.error(`Unknown scenario: ${scenarioName}`);
      return null;
    }
    
    let simulation;
    
    switch (scenarioName) {
      case 'ddos':
        simulation = new DDoSAttack(scenario, rng, canvasWidth, canvasHeight);
        break;
      case 'mitm':
        simulation = new MITMAttack(scenario, rng, canvasWidth, canvasHeight);
        break;
      case 'firewall':
        simulation = new FirewallAttack(scenario, rng, canvasWidth, canvasHeight);
        break;
      case 'arpSpoof':
        simulation = new ARPSpoofAttack(scenario, rng, canvasWidth, canvasHeight);
        break;
      default:
        simulation = new DDoSAttack(scenario, rng, canvasWidth, canvasHeight);
    }
    
    simulation.initialize();
    return simulation;
  }
}

// Export to global scope
window.SCENARIOS = SCENARIOS;
window.SimulationFactory = SimulationFactory;