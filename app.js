document.addEventListener('DOMContentLoaded', () => {
  // Initialization & Settings
  const STATE_KEY = 'studentExpenseState';
  let state = {
    budget: 0,
    expenses: []
  };

  // DOM Elements
  const cursorDot = document.getElementById('neon-cursor');
  const cursorRing = document.getElementById('neon-cursor-ring');
  const modal = document.getElementById('budget-modal');
  const initBudgetInput = document.getElementById('initial-budget');
  const initBudgetBtn = document.getElementById('set-budget-btn');
  
  const budgetDisplay = document.getElementById('budget-display');
  const remainingDisplay = document.getElementById('remaining-display');
  const daysUntilBroke = document.getElementById('days-until-broke');
  const budgetProgress = document.getElementById('budget-progress');
  
  const form = document.getElementById('expense-form');
  const expenseAmount = document.getElementById('expense-amount');
  const expenseCategory = document.getElementById('expense-category');
  const expenseNote = document.getElementById('expense-note');
  const expenseListContainer = document.getElementById('expense-list-container');
  const aiNudges = document.getElementById('ai-nudges');

  let spendChartInstance = null;

  // 1. Custom Cursor
  document.addEventListener('mousemove', (e) => {
    cursorDot.style.left = `${e.clientX}px`;
    cursorDot.style.top = `${e.clientY}px`;
    
    // Slight delay for ring
    setTimeout(() => {
      cursorRing.style.left = `${e.clientX}px`;
      cursorRing.style.top = `${e.clientY}px`;
    }, 50);
  });

  // 2. 3D Tilt Effect
  const tiltCards = document.querySelectorAll('.tilt-card');
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -10; // Max 10deg
      const rotateY = ((x - centerX) / centerX) * 10;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    });
  });

  // 3. State Management & Load
  function loadState() {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      state = JSON.parse(saved);
      if (state.budget > 0) {
        modal.classList.remove('active');
        updateUI();
      }
    }
  }

  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  // 4. Modal Initial Budget Setup
  initBudgetBtn.addEventListener('click', () => {
    const val = parseFloat(initBudgetInput.value);
    if (val && val > 0) {
      state.budget = val;
      saveState();
      modal.classList.remove('active');
      triggerConfetti();
      updateUI();
      showToast('Budget Initialized! Good luck surviving.', 'var(--neon-green)');
    }
  });

  // 5. Main Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount.value);
    const category = expenseCategory.value;
    const note = expenseNote.value || '';
    
    if (!amount || !category) return;

    const expense = {
      id: Date.now(),
      amount,
      category,
      note,
      date: new Date().toISOString()
    };

    state.expenses.unshift(expense);
    saveState();
    
    // Reset Form
    expenseAmount.value = '';
    expenseCategory.value = '';
    expenseNote.value = '';

    triggerConfetti();
    showToast(`Logged ₹${amount} for ${category}`, 'var(--neon-blue)');
    updateUI();
  });

  // 6. UI Updates
  function updateUI() {
    renderStats();
    renderExpenses();
    updateChart();
    generateSmartNudges();
  }

  function renderStats() {
    const totalSpent = state.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = state.budget - totalSpent;
    
    budgetDisplay.textContent = `₹${state.budget}`;
    remainingDisplay.textContent = `₹${remaining}`;
    
    // Progress Bar width
    const percentage = Math.max(0, Math.min(100, (remaining / state.budget) * 100));
    budgetProgress.style.width = `${percentage}%`;
    budgetProgress.style.backgroundColor = percentage < 20 ? 'var(--neon-pink)' : percentage < 50 ? 'var(--neon-blue)' : 'var(--neon-green)';

    // Days Until Broke Logic
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    
    let daysLeft = '∞';
    
    if (totalSpent > 0 && currentDay > 1) {
      const dailyBurnRate = totalSpent / currentDay; // Average spend per day so far
      const predictedDays = remaining / dailyBurnRate;
      
      daysLeft = predictedDays > 99 ? '99+' : Math.max(0, Math.floor(predictedDays));
      
      if (remaining <= 0) daysLeft = 0;
    } else if (totalSpent > 0 && currentDay === 1) {
       daysLeft = Math.floor(remaining / totalSpent);
       if(daysLeft > 99) daysLeft = '99+';
    }

    daysUntilBroke.textContent = remaining <= 0 ? '0' : daysLeft;
    
    // Pulse faster if broke soon
    if (daysLeft !== '∞' && daysLeft <= 3) {
      daysUntilBroke.style.color = 'var(--neon-pink)';
      daysUntilBroke.style.animationDuration = '1s';
    } else {
      daysUntilBroke.style.color = 'var(--neon-green)';
      daysUntilBroke.style.animationDuration = '3s';
    }
  }

  function renderExpenses() {
    expenseListContainer.innerHTML = '';
    state.expenses.slice(0, 10).forEach(exp => {
      const div = document.createElement('div');
      div.className = 'expense-item';
      
      // Map category to color class
      const catClassMap = {
        'Food & Canteen': 'cat-food',
        'Transport': 'cat-transport',
        'Stationery': 'cat-stationery',
        'Subs & Ent': 'cat-subs',
        'Social Outings': 'cat-social'
      };

      const dateStr = new Date(exp.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });

      div.innerHTML = `
        <div class="expense-info">
          <div class="text-mono ${catClassMap[exp.category]} font-bold">${exp.category}</div>
          <div class="note">${exp.note ? exp.note + ' • ' : ''}${dateStr}</div>
        </div>
        <div class="expense-amount-val bebas">₹${exp.amount}</div>
      `;
      expenseListContainer.appendChild(div);
    });
  }

  function getCategoryTotals() {
    return state.expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});
  }

  function updateChart() {
    const ctx = document.getElementById('spendChart');
    if (!ctx) return;

    const totals = getCategoryTotals();
    const labels = Object.keys(totals);
    const data = Object.values(totals);
    
    // Extract CSS variables for chart colors
    const style = getComputedStyle(document.body);
    const colors = labels.map(label => {
      if (label === 'Food & Canteen') return style.getPropertyValue('--cat-food').trim();
      if (label === 'Transport') return style.getPropertyValue('--cat-transport').trim();
      if (label === 'Stationery') return style.getPropertyValue('--cat-stationery').trim();
      if (label === 'Subs & Ent') return style.getPropertyValue('--cat-subs').trim();
      if (label === 'Social Outings') return style.getPropertyValue('--cat-social').trim();
      return '#fff';
    });

    if (spendChartInstance) {
      spendChartInstance.data.labels = labels;
      spendChartInstance.data.datasets[0].data = data;
      spendChartInstance.data.datasets[0].backgroundColor = colors;
      spendChartInstance.update();
    } else {
      spendChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#fff', font: { family: 'Space Mono' } }
            }
          }
        }
      });
    }
  }

  function generateSmartNudges() {
    const totalSpent = state.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = state.budget - totalSpent;

    if (state.expenses.length === 0) {
      aiNudges.innerHTML = `<div>System nominal. Log an expense to generate insights.</div>`;
      return;
    }

    let nudges = [];
    
    const totals = getCategoryTotals();
    
    // Sort categories by expenditure
    const sortedCats = Object.entries(totals).sort((a,b) => b[1] - a[1]);
    const maxSpentCat = sortedCats[0];
    
    if (maxSpentCat) {
      const percentage = Math.round((maxSpentCat[1] / totalSpent) * 100);
      nudges.push(`You spent <span style="color:var(--neon-pink)">${percentage}%</span> on ${maxSpentCat[0]}.`);
      
      if (maxSpentCat[0] === 'Food & Canteen' || maxSpentCat[0] === 'Social Outings') {
        nudges.push(`Try reducing ${maxSpentCat[0].toLowerCase()} to extend your survival time by a few days.`);
      }
    }

    if (remaining < state.budget * 0.2) {
      nudges.push(`<strong style="color:var(--neon-pink)">CRITICAL WARNING:</strong> Budget depletion imminent. Stop spending immediately.`);
    }

    // Now calculate average
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeftInMonth = daysInMonth - currentDay;

    if (remaining > 0 && daysLeftInMonth > 0) {
      const suggestedDaily = Math.floor(remaining / daysLeftInMonth);
      nudges.push(`Cut your spend to <strong>₹${suggestedDaily}/day</strong> to last till month end.`);
    }

    aiNudges.innerHTML = nudges.map(n => `<div style="margin-bottom:8px;">> ${n}</div>`).join('');
  }

  // Utilities
  function triggerConfetti() {
    if (typeof confetti !== 'undefined') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#39ff14', '#0ff', '#ff00ff']
      });
    }
  }

  function showToast(message, color) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast text-mono';
    toast.textContent = message;
    toast.style.borderLeftColor = color;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Boot up
  loadState();
});
