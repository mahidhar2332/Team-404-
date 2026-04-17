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

  // Cinematic Splash Sequence (Jumble Decode Phase)
  const jumbleEl = el('splash-main-text');
  if (jumbleEl) {
    const target = "BROKE";
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
        jumbleEl.innerHTML = `BROKE<span class="q-curve">?</span>`;
        setTimeout(() => playSound('sound-swoosh'), 200); // Trigger swoosh nicely along with question mark animation
      }
    }, 40);
  }

  setTimeout(() => {
    const splash = el('splash-screen');
    if (splash) splash.remove();
  }, 4500);

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

  el('start-tracking-btn').addEventListener('click', () => {
    const val = parseFloat(el('setup-budget-input').value);
    if (val && val > 0) {
      budget = val;
      localStorage.setItem('budget', budget);
      localStorage.setItem('categories', JSON.stringify(customCategories));
      showView('dashboard');
      el('bottom-nav').style.display = 'flex';
      showToast('Budget initialized!');
    } else {
      showToast('Enter a valid budget.');
    }
  });

  // Glass Nav Routing
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', (e) => {
      const targetView = e.currentTarget.getAttribute('data-target');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      e.currentTarget.classList.add('active');
      showView(targetView.replace('view-', ''));
    });
  });

  el('save-expense-btn').addEventListener('click', () => {
    const amt = parseFloat(el('add-amount').value);
    const note = el('add-note').value;
    const isRecurring = el('add-recurring').checked;
    const payMode = el('add-payment-mode') ? el('add-payment-mode').value : 'Cash';
    if (!amt || amt <= 0) return showToast('Enter valid amount');

    expenses.push({ id: Date.now(), amount: amt, category: currentCategory, paymentMode: payMode, note: `${note} ${isRecurring ? '(Recurring)' : ''}`, date: new Date().toISOString() });
    localStorage.setItem('expenses', JSON.stringify(expenses));

    playSound('sound-tada');

    el('add-amount').value = '';
    el('add-note').value = '';
    showToast('Expense Added!');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-target="view-dashboard"]').classList.add('active');
    showView('dashboard');
  });

  el('stash-btn').addEventListener('click', () => {
    const amt = parseFloat(el('stash-input').value);
    if (!amt || amt <= 0) return;
    stash += amt;
    localStorage.setItem('stash', stash);
    el('stash-input').value = '';
    updateKeeperUI();
    playSound('sound-coin');
    showToast('Money locked into Keeper!');
  });

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

  el('add-custom-cat-btn').addEventListener('click', () => openCatModal(false));

  const showWrap = el('show-wrap-btn');
  if(showWrap) showWrap.addEventListener('click', () => triggerMonthWrap());
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

  // If "Recurring (Manual)" is explicitly off (e.isRecurring === false), DO NOT deduct from budget
  const actionableExps = monthExps.filter(e => e.isRecurring !== false);
  const totalSpent = actionableExps.reduce((a, b) => a + b.amount, 0);
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

  // Restore local heuristics for Days Until Broke
  updateDaysUntilBrokeUI(totalSpent, remBudget);

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

function updateDaysUntilBrokeUI(totalSpent, remBudget) {
  if (expenses.length === 0 || totalSpent === 0) {
    if (el('dash-days')) el('dash-days').innerText = "—";
    if (el('dash-warning-text')) el('dash-warning-text').innerText = "Waiting for first transaction...";
    if (el('days-meter')) {
        el('days-meter').style.strokeDashoffset = 282.7;
        el('days-meter').style.stroke = '#8A8D98';
    }
    return;
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;

  let daysUntilBrokeVal = daysLeft;
  if (remBudget <= 0) daysUntilBrokeVal = 0;
  else if (totalSpent > 0 && now.getDate() > 1) {
    daysUntilBrokeVal = Math.floor(remBudget / (totalSpent / (now.getDate() - 1)));
  }

  if (daysUntilBrokeVal > daysInMonth) daysUntilBrokeVal = daysInMonth;

  animateValue(el('dash-days'), 0, daysUntilBrokeVal, 600);

  const circMeter = el('days-meter');
  let dashPerc = (daysUntilBrokeVal / daysInMonth);
  if (dashPerc > 1) dashPerc = 1;
  if (dashPerc < 0) dashPerc = 0;
  const offset = 282.7 - (dashPerc * 282.7);

  if (circMeter) {
    circMeter.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), stroke 0.5s';
    circMeter.style.strokeDashoffset = offset;
  }

  let warningStr = `Running out before month ends`;
  const dashDaysNode = el('dash-days');
  const warningTextNode = el('dash-warning-text');

  if (daysUntilBrokeVal < 7) {
    if (circMeter) circMeter.style.stroke = '#ef4444';
    if (dashDaysNode) dashDaysNode.style.color = '#ef4444';
    if (warningTextNode) warningTextNode.style.color = '#ef4444';
    warningStr = "Out of funds.";
  } else if (daysUntilBrokeVal < 15) {
    if (circMeter) circMeter.style.stroke = '#FFD166';
    if (dashDaysNode) dashDaysNode.style.color = '#FFD166';
    if (warningTextNode) warningTextNode.style.color = '#8A8D98';
  } else {
    if (circMeter) circMeter.style.stroke = '#4ADE80';
    if (dashDaysNode) dashDaysNode.style.color = '#4ADE80';
    if (warningTextNode) warningTextNode.style.color = '#8A8D98';
    warningStr = "On track to last the month!";
  }

  if (warningTextNode) warningTextNode.innerText = `⚠ ${warningStr}`;
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

    const mLabels = Object.keys(mCatTotals).filter(k => mCatTotals[k] > 0);
    if (mLabels.length === 0) mLabels.push('No Data');
    const mData = mLabels.map(k => mCatTotals[k] || 1);
    const mBg = mLabels.map(l => { const match = customCategories.find(c => c.name === l); return match ? match.color : '#8A8D98'; });

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

    const yLabels = Object.keys(yCatTotals).filter(k => yCatTotals[k] > 0);
    if (yLabels.length === 0) yLabels.push('No Data');
    const yData = yLabels.map(k => yCatTotals[k] || 1);
    const yBg = yLabels.map(l => { const match = customCategories.find(c => c.name === l); return match ? match.color : '#8A8D98'; });

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
  
  const actionableExps = monthExps.filter(e => e.isRecurring !== false);
  const totalSpent = actionableExps.reduce((a, b) => a + b.amount, 0);
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
    wrapScreen.className = \`month-wrap-screen active \${s.bg}\`;
    playSound('sound-swoosh');
    content.innerHTML = \`
      <div class="wrap-emoji">\${s.emoji}</div>
      <div class="wrap-title">\${s.title}</div>
      <div class="wrap-hero">\${s.hero}</div>
      <div class="wrap-sub">\${s.sub}</div>
    \`;
    
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

document.addEventListener('DOMContentLoaded', init);
