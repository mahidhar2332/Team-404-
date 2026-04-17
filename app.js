const el = id => document.getElementById(id);
let views = {};
let budget = 0;
let expenses = [];
let stash = 0;
let currentCategory = 'Food & Canteen';
let yearlyChart = null;
let monthlyChart = null;

const defaultCategories = [
  { name: 'Food & Canteen', icon: '🍱', color: '#F05E59' },
  { name: 'Transport', icon: '🚕', color: '#4ADE80' },
  { name: 'Stationery & Academics', icon: '📚', color: '#FFD166' },
  { name: 'Subscriptions & Entertainment', icon: '🎧', color: '#9d4edd' },
  { name: 'Social Outings', icon: '🎉', color: '#38bdf8' }
];

let customCategories = defaultCategories;

function playSound(id) {
  const audio = el(id);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Audio blocked', e));
  }
}

function init() {
  playSound('sound-coin');

  // Cinematic Splash Sequence (Jumble Decode Phase 1)
  const splash = el('splash-screen');
  const jumbleEl = el('splash-main-text');
  if (jumbleEl) {
    const target = "EXPENZA";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*@!$123456789";
    let inter = 0;
    const scrambler = setInterval(() => {
      jumbleEl.innerText = target.split("").map((letter, index) => {
        if (index < Math.floor(inter)) return target[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join("") + " ?";

      inter += 1 / 3;
      if (inter >= target.length) {
        clearInterval(scrambler);
        jumbleEl.innerHTML = `EXPENZA<span class="q-curve">?</span>`;
        
        // Phase 2: Trigger Orbit after jumble settles
        setTimeout(() => {
          if (splash) splash.classList.add('start-orbit');
          playSound('sound-swoosh');
        }, 500); 
      }
    }, 40);
  }

  // Phase 3: Total delay for splash removal (5.5s)
  setTimeout(() => {
    if (splash) splash.remove();
  }, 6500);


  views = {
    'setup': el('view-setup'),
    'dashboard': el('view-dashboard'),
    'add-expense': el('view-add-expense'),
    'keeper': el('view-keeper')
  };
  budget = localStorage.getItem('budget') ? parseFloat(localStorage.getItem('budget')) : 0;
  expenses = localStorage.getItem('expenses') ? JSON.parse(localStorage.getItem('expenses')) : [];
  stash = localStorage.getItem('stash') ? parseFloat(localStorage.getItem('stash')) : 0;

  // Safety load custom categories safely
  try {
    const saved = localStorage.getItem('categories');
    if (saved) customCategories = JSON.parse(saved);
    if (!Array.isArray(customCategories) || customCategories.length === 0) customCategories = defaultCategories;
  } catch (e) {
    customCategories = defaultCategories;
  }

  setupDateTime();
  if (budget > 0) {
    showView('dashboard', true); // init load, use replaceState
    el('bottom-nav').style.display = 'flex';
    checkEndOfMonthRollover();
    history.replaceState({ view: 'dashboard' }, "", "#dashboard");
  } else {
    showView('setup', true);
    history.replaceState({ view: 'setup' }, "", "#setup");
  }

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.view) {
      showView(e.state.view, true);
    }
  });

  // Setup Setup View logic
  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', (e) => {
      document.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
      e.target.classList.add('active');
      el('setup-budget-input').value = e.target.getAttribute('data-val');
    });
  });

  // Setup Custom Categories before tracking starts
  renderSetupCategories();

  const catModal = el('category-modal');
  const catNameInput = el('cat-modal-name');
  const catEmojiInput = el('cat-modal-emoji');
  let isSetupMode = false;

  const openCatModal = (setupMode) => {
    isSetupMode = setupMode;
    if (catModal) catModal.classList.add('active');
    if (catNameInput) catNameInput.value = '';
    if (catEmojiInput) catEmojiInput.value = '';
    setTimeout(() => { if (catNameInput) catNameInput.focus() }, 100);
  };

  const closeCatModal = () => {
    if (catModal) catModal.classList.remove('active');
  };

  if (el('cat-modal-cancel')) el('cat-modal-cancel').addEventListener('click', closeCatModal);
  if (el('cat-modal-save')) el('cat-modal-save').addEventListener('click', () => {
    const name = catNameInput ? catNameInput.value.trim() : '';
    if (!name) return showToast("Enter a category name");
    const emoji = (catEmojiInput && catEmojiInput.value.trim().length > 0) ? catEmojiInput.value.trim() : '🌟';

    customCategories.push({ name: name, icon: emoji, color: '#FFD166' });
    localStorage.setItem('categories', JSON.stringify(customCategories));
    
    if (isSetupMode) renderSetupCategories();
    else renderCategoriesUI();
    
    showToast('Category Added!');
    closeCatModal();
  });

  const setupAddBtn = el('setup-add-cat');
  if (setupAddBtn) {
    setupAddBtn.addEventListener('click', () => openCatModal(true));
  }

  const startBtn = el('start-tracking-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      const budgetInput = el('setup-budget-input');
      const val = budgetInput ? parseFloat(budgetInput.value) : 0;
      if (val && val > 0) {
        budget = val;
        localStorage.setItem('budget', budget);
        localStorage.setItem('categories', JSON.stringify(customCategories));
        showView('dashboard');
        const nav = el('bottom-nav');
        if (nav) nav.style.display = 'flex';
        showToast('Budget initialized!');
      } else {
        showToast('Enter a valid budget.');
      }
    });
  }


  // Glass Nav Routing
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', (e) => {
      const targetView = e.currentTarget.getAttribute('data-target');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      e.currentTarget.classList.add('active');
      showView(targetView.replace('view-', ''));
    });
  });

  const saveExpenseBtn = el('save-expense-btn');
  if (saveExpenseBtn) {
    saveExpenseBtn.addEventListener('click', () => {
      const amtInput = el('add-amount');
      const amt = amtInput ? parseFloat(amtInput.value) : 0;
      const noteInput = el('add-note');
      const note = noteInput ? noteInput.value : '';
      const typeInput = el('add-expense-type');
      const expenseType = typeInput ? typeInput.value : 'One-Time';
      const payModeInput = el('add-payment-mode');
      const payMode = payModeInput ? payModeInput.value : 'Cash';
      
      if (!amt || amt <= 0) return showToast('Enter valid amount');

      const dateInput = el('add-date');
      const customDate = (dateInput && dateInput.value) ? new Date(dateInput.value).toISOString() : new Date().toISOString();

      expenses.push({ 
        id: Date.now(), 
        amount: amt, 
        category: currentCategory, 
        paymentMode: payMode, 
        note: `${note} (${expenseType})`.trim(), 
        expenseType: expenseType,
        isRecurring: expenseType === 'Recurring',
        date: customDate 
      });
      localStorage.setItem('expenses', JSON.stringify(expenses));
      playSound('sound-tada');

      if (amtInput) amtInput.value = '';
      if (noteInput) noteInput.value = '';
      showToast('Expense Added!');

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const dashNav = document.querySelector('[data-target="view-dashboard"]');
      if (dashNav) dashNav.classList.add('active');
      showView('dashboard');
    });
  }


  const stashBtn = el('stash-btn');
  if (stashBtn) {
    stashBtn.addEventListener('click', () => {
      const stashInput = el('stash-input');
      const amt = stashInput ? parseFloat(stashInput.value) : 0;
      if (!amt || amt <= 0) return;
      stash += amt;
      localStorage.setItem('stash', stash);
      if (stashInput) stashInput.value = '';
      updateKeeperUI();
      playSound('sound-coin');
      showToast('Money locked into Keeper!');
    });
  }


  const withdrawBtn = el('withdraw-btn');
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', () => {
      const amt = parseFloat(el('stash-input').value);
      if (!amt || amt <= 0) return showToast("Enter amount to withdraw");
      if (amt > stash) return showToast("Not enough stashed savings!");
      stash -= amt;
      localStorage.setItem('stash', stash);
      el('stash-input').value = '';
      updateKeeperUI();
      playSound('sound-swoosh');
      showToast('Savings withdrawn back to budget!');
      if (views['dashboard'] && views['dashboard'].classList.contains('active')) updateDashboard();
    });
  }

  renderCategoriesUI();

  const addCustomCatBtn = el('add-custom-cat-btn');
  if (addCustomCatBtn) {
    addCustomCatBtn.addEventListener('click', () => openCatModal(false));
  }

  const showWrap = el('show-wrap-btn');
  if (showWrap) showWrap.addEventListener('click', () => triggerMonthWrap());

  const resetBtn = el('reset-app-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to reset all tracking data? This cannot be undone.")) {
        localStorage.clear();
        location.reload();
      }
    });
  }
}


function renderSetupCategories() {
  const container = el('setup-categories');
  if (!container) return;
  container.innerHTML = '';
  customCategories.forEach((cat, index) => {
    const tag = document.createElement('div');
    tag.className = 'setup-cat-tag';
    tag.innerHTML = `${cat.icon} ${cat.name} <span class="remove-cat" data-index="${index}">×</span>`;
    container.appendChild(tag);
  });
  
  document.querySelectorAll('.remove-cat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-index');
      customCategories.splice(idx, 1);
      renderSetupCategories();
    });
  });
}

function checkEndOfMonthRollover() {
  const d = new Date();
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  // Trigger auto keeper logic perfectly aligned to month-end requirements
  if (d.getDate() === lastDayOfMonth) {
    const key = `rollover_${d.getMonth()}_${d.getFullYear()}`;
    if (!localStorage.getItem(key)) {
      const monthExps = expenses.filter(e => {
        const ed = new Date(e.date);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
      });
      const totalSpent = monthExps.reduce((a, b) => a + b.amount, 0);
      const remBudget = budget - totalSpent;

      if (remBudget > 0) {
        stash += remBudget;
        localStorage.setItem('stash', stash);
        showToast(`MONTH END! ₹${remBudget} unspent budget auto-stashed in the Keeper!`);
      }
      localStorage.setItem(key, "true");
    }
  }
}

function renderCategoriesUI() {
  const list = el('add-category-list');
  list.innerHTML = '';
  customCategories.forEach((cat, index) => {
    // Set first to active automatically
    list.innerHTML += `
            <div class="cat-item ${index === 0 ? 'active' : ''}" data-cat="${cat.name}">
                <div class="emoji">${cat.icon}</div> <div class="name">${cat.name}</div>
            </div>
        `;
  });
  // Assign currently selected implicitly the first category initially
  if (customCategories.length > 0) currentCategory = customCategories[0].name;

  // Listeners
  document.querySelectorAll('.cat-item').forEach(c => {
    c.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-item').forEach(ch => ch.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      currentCategory = target.getAttribute('data-cat');
    });
  });
}

function showView(viewName, isHistoryEvent = false) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  if (views[viewName]) views[viewName].classList.add('active');

  if (viewName === 'dashboard') updateDashboard();
  if (viewName === 'keeper') updateKeeperUI();

  if (!isHistoryEvent) {
      history.pushState({ view: viewName }, "", `#${viewName}`);
  }
}

function updateKeeperUI() {
  animateValue(el('stashed-amount'), 0, stash, 1000);
  const heightPerc = Math.min((stash / (budget || 5000)) * 100, 100);
  if (el('jar-level')) el('jar-level').style.height = `${heightPerc}%`;
}

function setupDateTime() {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const d = new Date();
  const str = `${months[d.getMonth()]} ${d.getFullYear()}`.toUpperCase();
  let dmd = el('dash-month-display'); if (dmd) dmd.innerText = str;
}

// Math Easing Animation
function animateValue(obj, start, end, duration) {
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    obj.innerHTML = Math.floor(start + easeOut * (end - start)).toLocaleString('en-IN');
    if (progress < 1) window.requestAnimationFrame(step);
    else obj.innerHTML = end.toLocaleString('en-IN');
  };
  window.requestAnimationFrame(step);
}

function updateDashboard() {
  const now = new Date();
  const monthExps = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // ALL expenses (autopay and manual) safely deduct from budget
  const totalSpent = monthExps.reduce((a, b) => a + b.amount, 0);
  const remBudget = budget - totalSpent - stash; // Stash deducted from allowance
  const maxAvailable = budget - stash;
  const percUsed = maxAvailable > 0 ? Math.min(100, (totalSpent / maxAvailable) * 100) : 0;

  animateValue(el('dash-spent'), 0, totalSpent, 1000);
  animateValue(el('dash-rem'), 0, remBudget > 0 ? remBudget : 0, 1000);

  if (el('dash-budget')) el('dash-budget').innerText = maxAvailable.toLocaleString('en-IN');
  if (el('dash-perc')) el('dash-perc').innerText = `${Math.round(percUsed)}% used`;

  const spMeter = el('spent-meter');
  if (spMeter) {
    spMeter.style.width = `${percUsed}%`;
    spMeter.className = `linear-meter ${percUsed > 90 ? 'danger' : (percUsed > 75 ? 'warning' : 'bg-darker')}`;
  }

  // Category Breakdown Layout Update (matching Image 1 layout verbatim)
  const cListUI = el('category-breakdown-list');
  if (cListUI) {
    cListUI.innerHTML = '';
    let maxCatVal = 0;
    const catTotals = {};
    monthExps.forEach(e => {
      catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
      if (catTotals[e.category] > maxCatVal) maxCatVal = catTotals[e.category];
    });

    customCategories.forEach(cat => {
      const val = catTotals[cat.name] || 0;
      if (val === 0 && monthExps.length > 0) return;
      cListUI.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 1.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: center;">
                    <div style="font-family: 'Roboto Mono', monospace; font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center;">
                        <span style="font-size: 1.15rem; margin-right: 0.8rem;">${cat.icon}</span> ${cat.name}
                    </div>
                    <div style="font-family: 'Roboto Mono', monospace; font-weight: 500; font-size: 0.9rem; color: ${val > 0 ? '#fff' : 'var(--text-muted)'}">${val > 0 ? '₹' + val.toLocaleString('en-IN') : '-'}</div>
                </div>`;
    });
  }

  // Run Dual Charts locally
  if (window.innerWidth >= 950) {
    updateDualCharts(monthExps);
    renderHistory(monthExps);
  }

  // Always update Days Until Broke — shows 30 days baseline even when no expenses logged
  updateDaysUntilBrokeUI(monthExps, totalSpent, remBudget);

  // AI Insights
  const aiBox = el('ai-insight-box');
  const aiText = el('ai-insight-text');
  if (aiBox && aiText) {
    if (monthExps.length === 0) {
       aiBox.style.display = 'none';
    } else {
       if (percUsed > 80 && now.getDate() < 20) {
         aiBox.style.display = 'block';
         aiText.innerText = "You are spending way too fast! Slow down or you won't make it to month end.";
         playSound('sound-swoosh');
       } else if (remBudget < 1000 && remBudget > 0) {
         aiBox.style.display = 'block';
         aiText.innerText = "Critical budget level. Limit expenses to essentials only.";
       } else {
         aiBox.style.display = 'none';
       }
    }
  }
}

function updateDaysUntilBrokeUI(monthExps, totalSpent, remBudget) {
  const dashDaysNode = el('dash-days');
  const warningTextNode = el('dash-warning-text');
  const circMeter = el('days-meter');
  const trendNode = el('dash-trend');
  const predictionMsg = el('dash-prediction-msg');

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const daysElapsed = Math.max(1, now.getDate());

  // If budget is not set yet (shouldn't happen on dashboard but guard anyway)
  if (!budget || budget <= 0) return;


  if (remBudget <= 0) {
    if (dashDaysNode) { dashDaysNode.innerText = "0"; dashDaysNode.style.color = '#ef4444'; }
    if (warningTextNode) { warningTextNode.innerText = "⚠ Budget exhausted!"; warningTextNode.style.color = '#ef4444'; }
    if (circMeter) { circMeter.style.strokeDashoffset = 282.7; circMeter.style.stroke = '#ef4444'; }
    if (trendNode) trendNode.innerText = '📉';
    if (predictionMsg) {
      predictionMsg.style.display = 'block';
      predictionMsg.innerText = "You have run out of budget for this month.";
      predictionMsg.style.background = 'rgba(239,68,68,0.12)';
      predictionMsg.style.color = '#ef4444';
    }
    return;
  }

  // --- ADAPTIVE SPENDING ENGINE ---
  // Filter out Fixed/Autopay expenses from burn rate (they don't reflect daily habits)
  const variableExps = monthExps.filter(e => e.expenseType !== 'Fixed' && e.isRecurring !== true);

  // Group variable expenses by day-of-month
  const spendByDay = {};
  variableExps.forEach(e => {
    const d = new Date(e.date).getDate();
    spendByDay[d] = (spendByDay[d] || 0) + e.amount;
  });

  const variableSpent = variableExps.reduce((a, b) => a + b.amount, 0);

  // BASELINE: Budget / 30 → gives exactly 30 days as the starting point
  const baselineRate = budget / 30;

  const overallAvg = variableSpent > 0 ? variableSpent / daysElapsed : baselineRate;

  // Recent 3-day average
  const lastDay = now.getDate();
  let recentTotal = 0;
  let recentDays = 0;
  for (let d = Math.max(1, lastDay - 2); d <= lastDay; d++) {
    recentTotal += (spendByDay[d] || 0);
    recentDays++;
  }
  const recentAvg = recentDays > 0 ? recentTotal / recentDays : baselineRate;

  // If no spending has happened at all, anchor to baseline so widget shows 30 days
  const hasRealData = variableSpent > 0;

  // Did user spend ₹0 today?
  const spentToday = spendByDay[lastDay] || 0;
  const spentYesterday = spendByDay[lastDay - 1] || 0;

  // Weighted average (spike damper): 60% recent, 40% overall
  let adjustedAvg = hasRealData
    ? (0.6 * recentAvg) + (0.4 * overallAvg)
    : baselineRate;

  // Reward saving: if ₹0 spent today and there IS some spending history, ease rate down by 10%
  if (hasRealData && spentToday === 0) {
    adjustedAvg *= 0.9;
  }
  // If last 2 days both had zero spending, reduce further — days climb upward
  if (hasRealData && spentToday === 0 && spentYesterday === 0) {
    adjustedAvg *= 0.85;
  }

  // Always enforce a minimum floor of baselineRate so early-month spikes don't distort wildly
  if (daysElapsed <= 4) {
    adjustedAvg = Math.max(adjustedAvg, baselineRate);
  }

  // Determine trend for display
  let trend = 'stable';
  if (hasRealData) {
    if (recentAvg > overallAvg * 1.15) trend = 'worsening';
    else if (recentAvg < overallAvg * 0.85 || spentToday === 0) trend = 'improving';
  }

  let daysUntilBrokeVal;
  if (adjustedAvg <= 0) {
    daysUntilBrokeVal = 30; // fallback
  } else {
    daysUntilBrokeVal = Math.floor(remBudget / adjustedAvg);
    daysUntilBrokeVal = Math.min(daysUntilBrokeVal, 365);
    daysUntilBrokeVal = Math.max(daysUntilBrokeVal, 0);
  }

  // Animate and update number
  animateValue(dashDaysNode, 0, daysUntilBrokeVal, 800);

  // Circular meter — normalise against current month for visual proportion
  const meterRef = daysInMonth;
  let dashPerc = Math.min(daysUntilBrokeVal / meterRef, 1);
  if (dashPerc < 0) dashPerc = 0;
  const offset = 282.7 - (dashPerc * 282.7);
  if (circMeter) {
    circMeter.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), stroke 0.5s';
    circMeter.style.strokeDashoffset = offset;
  }

  // --- Colors, Trend Arrow, Messages ---
  let color, warningStr, predictionStr, predictionBg;

  if (adjustedAvg <= 0) {
    color = '#4ADE80';
    warningStr = '✅ Safe (No spending trend)';
    predictionStr = "You're on track for the month!";
    predictionBg = 'rgba(74,222,128,0.1)';
  } else if (daysUntilBrokeVal < 7) {
    color = '#ef4444';
    warningStr = '⚠ Critical — funds depleting fast!';
    predictionStr = `You may run out in ${daysUntilBrokeVal} days`;
    predictionBg = 'rgba(239,68,68,0.12)';
  } else if (daysUntilBrokeVal < daysLeft) {
    color = '#FFD166';
    warningStr = '⚡ You may run out before month ends';
    predictionStr = `You may run out in ${daysUntilBrokeVal} days`;
    predictionBg = 'rgba(255,209,102,0.1)';
  } else {
    color = '#4ADE80';
    warningStr = '✅ You\'re on track for the month!';
    predictionStr = "You're on track for the month!";
    predictionBg = 'rgba(74,222,128,0.1)';
  }

  if (circMeter) circMeter.style.stroke = color;
  if (dashDaysNode) dashDaysNode.style.color = color;
  if (warningTextNode) { warningTextNode.innerText = warningStr; warningTextNode.style.color = color === '#4ADE80' ? '#8A8D98' : color; }

  if (trendNode) {
    if (trend === 'improving') trendNode.innerText = '📈';
    else if (trend === 'worsening') trendNode.innerText = '📉';
    else trendNode.innerText = '➡️';
    trendNode.title = trend === 'improving' ? 'Spending trend improving' : trend === 'worsening' ? 'Spending trend worsening' : 'Spending trend stable';
  }

  if (predictionMsg) {
    predictionMsg.style.display = 'block';
    predictionMsg.innerText = predictionStr;
    predictionMsg.style.background = predictionBg;
    predictionMsg.style.color = color;
  }
}

function updateDualCharts(monthExps) {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.color = 'rgba(255,255,255,0.7)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  // Build Monthly Chart Data
  const mCtx = el('monthly-pie-chart')?.getContext('2d');
  if (mCtx) {
    const mCatTotals = {};
    customCategories.forEach(c => mCatTotals[c.name] = 0);
    monthExps.forEach(e => { mCatTotals[e.category] = (mCatTotals[e.category] || 0) + e.amount; });

    let mLabels = Object.keys(mCatTotals).filter(k => mCatTotals[k] > 0);
    let mData, mBg;

    if (mLabels.length === 0) {
        mLabels = ['Awaiting Data'];
        mData = [1];
        mBg = ['#2A2C35'];
    } else {
        mData = mLabels.map(k => mCatTotals[k] || 1);
        mBg = mLabels.map(l => { const match = customCategories.find(c => c.name === l); return match ? match.color : '#8A8D98'; });
    }

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(mCtx, {
      type: 'pie',
      data: { labels: mLabels, datasets: [{ data: mData, backgroundColor: mBg, borderWidth: 1, borderColor: '#1A1C23', hoverOffset: 15 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 10 } } } } }
    });
  }

  // Build Yearly Chart Data
  const yCtx = el('yearly-pie-chart')?.getContext('2d');
  if (yCtx) {
    const now = new Date();
    const yearExps = expenses.filter(e => new Date(e.date).getFullYear() === now.getFullYear());
    const yCatTotals = {};
    customCategories.forEach(c => yCatTotals[c.name] = 0);
    yearExps.forEach(e => { yCatTotals[e.category] = (yCatTotals[e.category] || 0) + e.amount; });

    let yLabels = Object.keys(yCatTotals).filter(k => yCatTotals[k] > 0);
    let yData, yBg;
    
    if (yLabels.length === 0) {
        yLabels = ['Awaiting Data'];
        yData = [1];
        yBg = ['#2A2C35'];
    } else {
        yData = yLabels.map(k => yCatTotals[k] || 1);
        yBg = yLabels.map(l => { const match = customCategories.find(c => c.name === l); return match ? match.color : '#8A8D98'; });
    }

    if (yearlyChart) yearlyChart.destroy();
    yearlyChart = new Chart(yCtx, {
      type: 'pie',
      data: { labels: yLabels, datasets: [{ data: yData, backgroundColor: yBg, borderWidth: 1, borderColor: '#1A1C23', hoverOffset: 15 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 10 } } } } }
    });
  }
}

function renderHistory(monthExps) {
  const log = el('history-log');
  if (!log) return;

  const sorted = [...monthExps].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  log.innerHTML = '';

  if (sorted.length === 0) {
    log.innerHTML = "<div style='color: var(--text-muted); font-size:0.8rem; text-align: left;'>No recent transactions</div>";
    return;
  }

  sorted.forEach(e => {
    const catObj = customCategories.find(c => c.name === e.category) || customCategories[0];
    const dateObj = new Date(e.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isToday = new Date().toDateString() === dateObj.toDateString();

    log.innerHTML += `
        <div class="hist-item">
            <div>
                <div style="font-weight: 600; margin-bottom: 0.2rem; font-size: 0.95rem;">${e.note || e.category}</div>
                <div class="hist-cat">${catObj.icon} ${e.category} 
                  <span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-left: 8px;">${e.paymentMode || 'Cash'}</span>
                </div>
                <div class="hist-timeblocks">
                    <div class="hist-date-pill ${isToday ? 'yellow' : ''}">${isToday ? 'TODAY' : dateStr}</div>
                    <div class="hist-time">${timeStr}</div>
                </div>
            </div>
            <div class="hist-amt" style="color: ${catObj.color}">-₹${e.amount}</div>
        </div>
        `;
  });
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerText = msg;
  const tc = el('toast-container');
  if (tc) {
    tc.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
  }
}

function triggerMonthWrap() {
  const wrapScreen = el('month-wrap-screen');
  const content = el('wrap-content');
  const bar = el('wrap-bar');
  if (!wrapScreen || !content) return;
  
  const now = new Date();
  const monthExps = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  
  // ALL expenses
  const totalSpent = monthExps.reduce((a, b) => a + b.amount, 0);
  const budgetRatio = budget > 0 ? (stash / budget) : 0;
  
  let scoreBadge = '';
  if (budgetRatio > 0.3) scoreBadge = '<div class="badge hardcore">Hard-core Saver</div>';
  else if (budgetRatio > 0.1) scoreBadge = '<div class="badge median">Median Saver</div>';
  else scoreBadge = '<div class="badge beginner">Beginner Saver</div>';

  wrapScreen.className = "month-wrap-screen active wrap-bg-1";
  playSound('sound-tada');
  
  const slides = [
    { title: "THIS MONTH", hero: "₹" + totalSpent.toLocaleString(), sub: "Total Expenditures", emoji: "💸", bg: "wrap-bg-1" },
    { title: "SAVIER SCORE", hero: "Your Tier", sub: scoreBadge, emoji: "🏆", bg: "wrap-bg-2" },
    { title: "THAT'S A WRAP", hero: "Ready for next month?", sub: "Keep stashing and tracking.", emoji: "🚀", bg: "wrap-bg-3" }
  ];
  
  let currentSlide = 0;
  
  const renderSlide = () => {
    if(currentSlide >= slides.length) {
      wrapScreen.classList.remove('active');
      return;
    }
    const s = slides[currentSlide];
    wrapScreen.className = `month-wrap-screen active ${s.bg}`;
    playSound('sound-swoosh');
    content.innerHTML = `
      <div class="wrap-emoji">${s.emoji}</div>
      <div class="wrap-title">${s.title}</div>
      <div class="wrap-hero">${s.hero}</div>
      <div class="wrap-sub">${s.sub}</div>
    `;
    
    bar.style.transition = 'none';
    bar.style.width = '0%';
    setTimeout(() => {
      bar.style.transition = 'width 3s linear';
      bar.style.width = '100%';
    }, 50);
    
    setTimeout(() => {
      currentSlide++;
      renderSlide();
    }, 3050);
  };
  
  renderSlide();
}

// Safe initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

