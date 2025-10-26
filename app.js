/**
 * Darth Invader - Main Application
 * Entry point, state management, UI controls, and canvas rendering
 */

// Application State
const AppState = {
  // Simulation state
  currentScenario: 'ddos',
  isRunning: false,
  isPaused: false,
  speed: 1.0,
  intensity: 50,
  seed: 12345,
  
  // Theme state
  theme: 'auto', // 'light', 'dark', 'auto'
  
  // Canvas state
  canvas: null,
  ctx: null,
  canvasWidth: 800,
  canvasHeight: 600,
  
  // Simulation instance
  simulation: null,
  rng: null,
  
  // Animation
  animationId: null,
  lastTime: 0,
  
  // Performance
  perfMonitor: null,
  
  // Chart
  metricsChart: null,
  chartData: [],
  chartUpdateCounter: 0
};

// Theme Management
const ThemeManager = {
  init() {
    // Try to get saved theme from memory (no localStorage in sandbox)
    this.currentTheme = 'auto';
    this.applyTheme();
    
    // Set up theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => this.cycleTheme());
    themeToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.cycleTheme();
      }
    });
  },
  
  cycleTheme() {
    const themes = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.currentTheme = themes[nextIndex];
    this.applyTheme();
  },
  
  applyTheme() {
    const root = document.documentElement;
    
    // Update icon visibility
    document.querySelectorAll('.theme-icon').forEach(icon => {
      icon.classList.remove('active');
    });
    
    let effectiveTheme = this.currentTheme;
    
    if (this.currentTheme === 'auto') {
      // Detect system preference
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.querySelector('.theme-icon-auto').classList.add('active');
    } else if (this.currentTheme === 'light') {
      document.querySelector('.theme-icon-light').classList.add('active');
    } else {
      document.querySelector('.theme-icon-dark').classList.add('active');
    }
    
    // Apply theme
    root.setAttribute('data-theme', effectiveTheme);
    AppState.theme = effectiveTheme;
    
    // Update chart colors if it exists
    if (AppState.metricsChart) {
      this.updateChartTheme();
    }
  },
  
  updateChartTheme() {
    const isDark = AppState.theme === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1f2937';
    const gridColor = isDark ? 'rgba(119, 124, 124, 0.2)' : 'rgba(94, 82, 64, 0.2)';
    
    AppState.metricsChart.options.scales.x.ticks.color = textColor;
    AppState.metricsChart.options.scales.y.ticks.color = textColor;
    AppState.metricsChart.options.scales.x.grid.color = gridColor;
    AppState.metricsChart.options.scales.y.grid.color = gridColor;
    AppState.metricsChart.update('none');
  }
};

// Canvas Renderer
const CanvasRenderer = {
  init() {
    AppState.canvas = document.getElementById('simulationCanvas');
    AppState.ctx = AppState.canvas.getContext('2d');
    AppState.perfMonitor = new PerformanceMonitor();
    
    // Set canvas size
    this.resizeCanvas();
    
    // Initial render
    this.render();
  },
  
  resizeCanvas() {
    // Keep fixed size for consistent simulation
    AppState.canvas.width = AppState.canvasWidth;
    AppState.canvas.height = AppState.canvasHeight;
  },
  
  clear() {
    const ctx = AppState.ctx;
    const isDark = AppState.theme === 'dark';
    
    // Clear with background color
    ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, 0, AppState.canvasWidth, AppState.canvasHeight);
  },
  
  render() {
    this.clear();
    
    if (AppState.simulation) {
      AppState.simulation.render(AppState.ctx);
    } else {
      // Show "Ready" message
      const ctx = AppState.ctx;
      ctx.fillStyle = Colors.get('text');
      ctx.font = '24px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Press Start to Begin Simulation', AppState.canvasWidth / 2, AppState.canvasHeight / 2);
    }
  }
};

// Simulation Controller
const SimulationController = {
  init() {
    AppState.rng = new SeededRandom(AppState.seed);
    this.loadScenario(AppState.currentScenario);
  },
  
  loadScenario(scenarioName) {
    AppState.currentScenario = scenarioName;
    AppState.rng.setSeed(AppState.seed);
    
    // Create new simulation
    AppState.simulation = SimulationFactory.create(
      scenarioName,
      AppState.rng,
      AppState.canvasWidth,
      AppState.canvasHeight
    );
    
    // Update UI
    const scenario = SCENARIOS[scenarioName];
    document.getElementById('scenarioTitle').textContent = scenario.name + ' Simulation';
    
    // Update scenario card active state
    document.querySelectorAll('.scenario-card').forEach(card => {
      card.classList.remove('active');
      if (card.dataset.scenario === scenarioName) {
        card.classList.add('active');
      }
    });
    
    // Reset metrics
    this.resetMetrics();
    
    // Render
    CanvasRenderer.render();
  },
  
  start() {
    if (AppState.isRunning && !AppState.isPaused) return;
    
    AppState.isRunning = true;
    AppState.isPaused = false;
    AppState.lastTime = performance.now();
    
    // Update UI
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('statusIndicator').className = 'status-indicator running';
    document.getElementById('statusText').textContent = 'Running';
    
    // Start animation loop
    this.animate();
  },
  
  pause() {
    AppState.isPaused = true;
    
    // Update UI
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('statusIndicator').className = 'status-indicator paused';
    document.getElementById('statusText').textContent = 'Paused';
    
    // Cancel animation
    if (AppState.animationId) {
      cancelAnimationFrame(AppState.animationId);
      AppState.animationId = null;
    }
  },
  
  reset() {
    // Stop animation
    this.pause();
    
    AppState.isRunning = false;
    AppState.isPaused = false;
    
    // Reload scenario
    this.loadScenario(AppState.currentScenario);
    
    // Update UI
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('statusIndicator').className = 'status-indicator stopped';
    document.getElementById('statusText').textContent = 'Ready';
    
    // Reset chart
    AppState.chartData = [];
    this.updateChart();
  },
  
  animate() {
    if (!AppState.isRunning || AppState.isPaused) return;
    
    const now = performance.now();
    const deltaTime = now - AppState.lastTime;
    AppState.lastTime = now;
    
    // Update simulation
    if (AppState.simulation) {
      AppState.simulation.update(deltaTime, AppState.speed, AppState.intensity);
    }
    
    // Render
    CanvasRenderer.render();
    
    // Update metrics display
    this.updateMetricsDisplay();
    
    // Update performance counter
    AppState.perfMonitor.update();
    const fps = AppState.perfMonitor.getFPS();
    document.getElementById('fpsCounter').textContent = `${fps} FPS`;
    
    // Update chart periodically
    AppState.chartUpdateCounter++;
    if (AppState.chartUpdateCounter >= 60) { // Update every second at 60fps
      AppState.chartUpdateCounter = 0;
      this.updateChart();
    }
    
    // Continue animation
    AppState.animationId = requestAnimationFrame(() => this.animate());
  },
  
  updateMetricsDisplay() {
    if (!AppState.simulation) return;
    
    const metrics = AppState.simulation.getMetrics();
    
    // Update metric cards
    document.getElementById('metricPacketsSent').textContent = metrics.packetsSent.toLocaleString();
    document.getElementById('metricPacketsReceived').textContent = metrics.packetsReceived.toLocaleString();
    document.getElementById('metricPacketsDropped').textContent = metrics.packetsDropped.toLocaleString();
    document.getElementById('metricPacketsBlocked').textContent = metrics.packetsBlocked.toLocaleString();
    
    // Update server load
    const loadPercent = Math.floor(metrics.serverLoad);
    document.getElementById('serverLoadPercent').textContent = `${loadPercent}%`;
    document.getElementById('serverLoadBar').style.width = `${loadPercent}%`;
    
    // Change color based on load
    const loadBar = document.getElementById('serverLoadBar');
    if (loadPercent > 80) {
      loadBar.classList.add('critical');
    } else {
      loadBar.classList.remove('critical');
    }
    
    // Update latency
    document.getElementById('latencyValue').textContent = `${metrics.latency} ms`;
  },
  
  updateChart() {
    if (!AppState.simulation || !AppState.metricsChart) return;
    
    const metrics = AppState.simulation.getMetrics();
    const timestamp = new Date().toLocaleTimeString();
    
    // Add data point
    AppState.chartData.push({
      time: timestamp,
      load: metrics.serverLoad
    });
    
    // Keep only last 60 data points
    if (AppState.chartData.length > 60) {
      AppState.chartData.shift();
    }
    
    // Update chart
    AppState.metricsChart.data.labels = AppState.chartData.map(d => d.time);
    AppState.metricsChart.data.datasets[0].data = AppState.chartData.map(d => d.load);
    AppState.metricsChart.update('none');
  },
  
  resetMetrics() {
    document.getElementById('metricPacketsSent').textContent = '0';
    document.getElementById('metricPacketsReceived').textContent = '0';
    document.getElementById('metricPacketsDropped').textContent = '0';
    document.getElementById('metricPacketsBlocked').textContent = '0';
    document.getElementById('serverLoadPercent').textContent = '0%';
    document.getElementById('serverLoadBar').style.width = '0%';
    document.getElementById('latencyValue').textContent = '0 ms';
  },
  
  updateSpeed(value) {
    AppState.speed = parseFloat(value);
    document.getElementById('speedValue').textContent = `${AppState.speed.toFixed(1)}x`;
  },
  
  updateIntensity(value) {
    AppState.intensity = parseInt(value);
    document.getElementById('intensityValue').textContent = `${AppState.intensity}%`;
  },
  
  updateSeed(value) {
    AppState.seed = parseInt(value) || 12345;
    if (AppState.rng) {
      AppState.rng.setSeed(AppState.seed);
    }
  }
};

// Chart Initialization
const ChartManager = {
  init() {
    const canvas = document.getElementById('metricsChart');
    const ctx = canvas.getContext('2d');
    
    const isDark = AppState.theme === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1f2937';
    const gridColor = isDark ? 'rgba(119, 124, 124, 0.2)' : 'rgba(94, 82, 64, 0.2)';
    const lineColor = isDark ? '#22d3ee' : '#3b82f6';
    
    AppState.metricsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Server Load %',
          data: [],
          borderColor: lineColor,
          backgroundColor: Colors.withAlpha(lineColor, 0.1),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHitRadius: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: textColor,
              maxRotation: 0,
              autoSkipPadding: 20,
              font: {
                size: 10
              }
            }
          },
          y: {
            display: true,
            min: 0,
            max: 100,
            grid: {
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: textColor,
              callback: (value) => value + '%',
              font: {
                size: 10
              }
            }
          }
        }
      }
    });
  }
};

// Session Management
const SessionManager = {
  export() {
    const sessionData = {
      scenario: AppState.currentScenario,
      seed: AppState.seed,
      speed: AppState.speed,
      intensity: AppState.intensity,
      metrics: AppState.simulation ? AppState.simulation.getMetrics() : {},
      chartData: AppState.chartData,
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `darth-invader-session-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  },
  
  import(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const sessionData = JSON.parse(e.target.result);
        
        // Restore session
        if (sessionData.scenario) {
          AppState.seed = sessionData.seed || 12345;
          AppState.speed = sessionData.speed || 1.0;
          AppState.intensity = sessionData.intensity || 50;
          
          // Update UI
          document.getElementById('seedInput').value = AppState.seed;
          document.getElementById('speedSlider').value = AppState.speed;
          document.getElementById('intensitySlider').value = AppState.intensity;
          SimulationController.updateSpeed(AppState.speed);
          SimulationController.updateIntensity(AppState.intensity);
          
          // Load scenario
          SimulationController.loadScenario(sessionData.scenario);
          
          // Restore chart data if available
          if (sessionData.chartData && sessionData.chartData.length > 0) {
            AppState.chartData = sessionData.chartData;
            SimulationController.updateChart();
          }
          
          alert('Session imported successfully!');
        }
      } catch (error) {
        console.error('Error importing session:', error);
        alert('Error importing session. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
  }
};

// UI Event Handlers
const UIController = {
  init() {
    // Control buttons
    document.getElementById('startBtn').addEventListener('click', () => SimulationController.start());
    document.getElementById('pauseBtn').addEventListener('click', () => SimulationController.pause());
    document.getElementById('resetBtn').addEventListener('click', () => SimulationController.reset());
    
    // Sliders
    document.getElementById('speedSlider').addEventListener('input', (e) => {
      SimulationController.updateSpeed(e.target.value);
    });
    
    document.getElementById('intensitySlider').addEventListener('input', (e) => {
      SimulationController.updateIntensity(e.target.value);
    });
    
    // Seed input
    document.getElementById('seedInput').addEventListener('change', (e) => {
      SimulationController.updateSeed(e.target.value);
      if (!AppState.isRunning) {
        SimulationController.reset();
      }
    });
    
    // Scenario selection
    document.querySelectorAll('.scenario-card').forEach(card => {
      card.addEventListener('click', () => {
        const scenario = card.dataset.scenario;
        if (scenario !== AppState.currentScenario) {
          SimulationController.reset();
          SimulationController.loadScenario(scenario);
        }
      });
    });
    
    // Session management
    document.getElementById('exportSession').addEventListener('click', () => SessionManager.export());
    document.getElementById('importSession').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        SessionManager.import(file);
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (AppState.isRunning && !AppState.isPaused) {
            SimulationController.pause();
          } else {
            SimulationController.start();
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          SimulationController.reset();
          break;
        case '1':
          SimulationController.loadScenario('ddos');
          break;
        case '2':
          SimulationController.loadScenario('mitm');
          break;
        case '3':
          SimulationController.loadScenario('firewall');
          break;
        case '4':
          SimulationController.loadScenario('arpSpoof');
          break;
      }
    });
    
    // Disclaimer
    document.getElementById('dismissDisclaimer').addEventListener('click', () => {
      document.getElementById('disclaimer').classList.add('hidden');
    });
  }
};

// Application Initialization
function initApp() {
  console.log('🚀 Darth Invader - Initializing...');
  
  // Initialize theme first (prevent FOUC)
  ThemeManager.init();
  
  // Initialize canvas
  CanvasRenderer.init();
  
  // Initialize simulation
  SimulationController.init();
  
  // Initialize chart
  ChartManager.init();
  
  // Initialize UI
  UIController.init();
  
  console.log('✅ Darth Invader - Ready!');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}