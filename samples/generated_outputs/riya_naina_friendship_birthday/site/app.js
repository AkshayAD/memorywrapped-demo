const data = window.CHAT_ANALYSIS;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Utilities
const format = (value) => new Intl.NumberFormat("en-IN").format(value ?? 0);
const shortName = (name) => (name || "").toLowerCase().includes("akshay") ? "Akshay" : (name || "").split(" ")[0];
const escapeHtml = (value) => {
  const span = document.createElement("span");
  span.textContent = value ?? "";
  return span.innerHTML;
};
const pct = (value, max) => `${Math.max((value / Math.max(max, 1)) * 100, 2).toFixed(2)}%`;

/* --- UI COMPONENTS --- */

function stat(label, value, detail) {
  // Using a data-value attribute to animate counting up
  const strValue = String(value);
  const isNumber = !isNaN(strValue.replace(/,/g, '')) && strValue.trim() !== '';
  const valMarkup = isNumber ? `<strong class="count-up" data-value="${strValue.replace(/,/g, '')}">0</strong>` : `<strong>${escapeHtml(value)}</strong>`;
  
  return `
    <article class="stat-card reveal">
      <span>${escapeHtml(label)}</span>
      ${valMarkup}
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}

function barRows(rows, labelKey = "name", valueKey = "messages") {
  const max = Math.max(...rows.map((row) => row[valueKey]), 1);
  return rows
    .map(
      (row) => `
        <div class="bar-row">
          <div class="bar-top"><span>${escapeHtml(row[labelKey])}</span><b>${format(row[valueKey])}</b></div>
          <div class="bar-track"><div class="bar-fill observe-bar" style="width:${pct(row[valueKey], max)}"></div></div>
        </div>
      `,
    )
    .join("");
}

function quoteCard(label, item) {
  return `
    <article class="quote-card reveal">
      <span>${escapeHtml(label)} &bull; ${escapeHtml(item.date)} &bull; ${escapeHtml(shortName(item.sender))}</span>
      <blockquote>"${escapeHtml(item.sample)}"</blockquote>
    </article>
  `;
}

/* --- TAB RENDERERS --- */

function renderOverview() {
  $("#page-title").textContent = data.title;
  // Typewriter effect handled separately
  
  $("#generated-at").textContent = `Analysis refreshed ${new Date(data.generatedAt).toLocaleString(
    "en-IN",
    { dateStyle: "medium", timeStyle: "short" },
  )}`;

  $("#overview-stats").innerHTML = [
    stat("Total Messages", format(data.overview.totalMessages), `${format(data.overview.totalWords)} words exchanged`),
    stat("Active Days", format(data.overview.activeDays), `${data.overview.firstDate} to ${data.overview.lastDate}`),
    stat("Longest Streak", `${format(data.overview.activeStreak.days)} days`, `${data.overview.activeStreak.from} to ${data.overview.activeStreak.to}`),
    stat("Daily Rhythm", data.overview.avgPerActiveDay, "messages per active day"),
    stat("Media Shared", format(data.overview.media), `${format(data.overview.links)} links exchanged`),
    stat("Curiosity", format(data.overview.questions), "questions asked, plans made"),
    stat("Reconnections", format(data.overview.sessions), "conversation sessions started"),
    stat("Peak Chapter", data.overview.topMonth.label, `${format(data.overview.topMonth.messages)} messages`),
  ].join("");
}

function lineChart(rows, { senderMode = false } = {}) {
  const width = 980;
  const height = 350;
  const pad = { top: 30, right: 30, bottom: 50, left: 60 };
  const max = Math.max(...rows.map((row) => row.messages), 1);
  const x = (idx) => pad.left + (idx / Math.max(rows.length - 1, 1)) * (width - pad.left - pad.right);
  const y = (value) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom);
  const points = rows.map((row, idx) => `${x(idx)},${y(row.messages)}`).join(" ");
  
  const area = `${pad.left},${height - pad.bottom} ${points} ${width - pad.right},${height - pad.bottom}`;
  const labels = rows
    .filter((_, idx) => idx === 0 || idx === rows.length - 1 || idx % 6 === 0)
    .map((row) => `<text class="axis-label" x="${x(rows.indexOf(row))}" y="${height - 20}" text-anchor="middle">${row.label}</text>`)
    .join("");

  // Subtle grid lines
  const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => {
    const yPos = height - pad.bottom - (ratio * (height - pad.top - pad.bottom));
    return `<line x1="${pad.left}" y1="${yPos}" x2="${width - pad.right}" y2="${yPos}" class="chart-grid-line" stroke-dasharray="4 4" />`;
  }).join("");

  let senderLines = "";
  if (senderMode) {
    const colors = ["#c9a96e", "#e8b4b8"];
    senderLines = data.participants
      .map((sender, idx) => {
        const p = rows.map((row, i) => `${x(i)},${y(row.senders[sender] || 0)}`).join(" ");
        return `<polyline class="line-path" points="${p}" fill="none" stroke="${colors[idx % colors.length]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
      })
      .join("");
  }

  return `
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly message chart">
      <defs>
        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#c9a96e" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#c9a96e" stop-opacity="0" />
        </linearGradient>
      </defs>
      ${gridLines}
      <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="rgba(255,255,255,0.1)" />
      <polygon points="${area}" fill="url(#areaGradient)" />
      <polyline class="line-path" points="${points}" fill="none" stroke="#c9a96e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${senderLines}
      ${labels}
      <text class="axis-label" x="${pad.left}" y="${pad.top - 12}">${format(max)} peak</text>
    </svg>
  `;
}

function renderStoryTab() {
  $("#tab-story").innerHTML = `
    <div class="story-grid">
      <article class="feature-panel wide reveal">
        <div class="panel-heading">
          <div>
            <h3>The Flow of Time</h3>
            <p>The crescendo of ${escapeHtml(data.overview.topMonth.label)} marked the loudest chapter.</p>
          </div>
        </div>
        ${lineChart(data.monthly)}
      </article>
      <div class="wide">
        <div class="quad-grid">
          ${quoteCard("The Beginning", data.firstLast.firstText)}
          ${quoteCard("The Latest", data.firstLast.lastText)}
        </div>
      </div>
    </div>
    
    <div class="chapter-timeline reveal">
      ${data.yearChapters
        .map(
          (chapter) => `
            <article class="year-card">
              <span>${chapter.year}</span>
              <strong class="count-up" data-value="${chapter.messages}">0</strong>
              <p>${format(chapter.activeDays)} active days. Peak: ${escapeHtml(chapter.topMonth.label)}.</p>
              <blockquote>"${escapeHtml(chapter.firstSample.sample)}"</blockquote>
            </article>
          `,
        )
        .join("")}
    </div>

    <div class="split-grid">
      <article class="feature-panel reveal">
        <h3>Loudest Months</h3>
        ${barRows(data.topMonths, "label", "messages")}
      </article>
      <article class="feature-panel reveal">
        <h3>Story Motifs</h3>
        <div class="motif-grid">${motifCards(data.motifs || [])}</div>
      </article>
    </div>
  `;
}

function motifCards(rows) {
  if (!rows || rows.length === 0) return "<p>Data mapping...</p>";
  return rows
    .map(
      (row) => `
        <article class="mini-card">
          <span>${escapeHtml(row.firstDate)} &bull; ${escapeHtml(shortName(row.firstSender))}</span>
          <strong style="color: var(--gold);">${escapeHtml(row.label)}</strong>
          <p>${format(row.count)} occurrences</p>
          <blockquote>"${escapeHtml(row.sample)}"</blockquote>
        </article>
      `,
    )
    .join("");
}

function renderHeatmap() {
  return `
    <div class="heatmap">
      ${data.heatmap
        .map(
          (row) => `
            <div class="heatmap-row">
              <div class="heatmap-day">${row.day}</div>
              ${row.hours
                .map(
                  (cell) =>
                    `<div class="heat-cell" style="--i:${cell.intensity}" title="${row.day} ${String(cell.hour).padStart(2, "0")}:00 - ${format(cell.value)} messages"></div>`,
                )
                .join("")}
            </div>
          `,
        )
        .join("")}
      <div class="heat-legend" style="display:flex; justify-content:space-between; margin-top:12px; color:var(--text-muted); font-size:0.75rem;">
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
    </div>
  `;
}

function renderRhythmTab() {
  const replyRows = Object.entries(data.replyTimes).map(([sender, row]) => ({ sender, ...row }));
  $("#tab-rhythm").innerHTML = `
    <div class="split-grid rhythm-split">
      <article class="feature-panel wide reveal">
        <h3>The Rhythm of the Week</h3>
        ${renderHeatmap()}
      </article>
      <article class="feature-panel reveal">
        <h3>Reply Tempo</h3>
        <div class="metric-list" style="display:flex; flex-direction:column; gap:24px;">
          ${replyRows
            .map(
              (row) => `
                <div class="metric-item" style="border-bottom: var(--border-glass); padding-bottom: 16px;">
                  <span>${escapeHtml(shortName(row.sender))}'s median reply</span>
                  <strong style="font-size:2rem; color:var(--gold); margin:8px 0;">${escapeHtml(row.medianMinutes)} min</strong>
                  <p>${format(row.samples)} turns; 75% within ${escapeHtml(row.p75Minutes)} min.</p>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>
    </div>
    <div class="quad-grid">
      <article class="feature-panel reveal"><h3>Times of Day</h3>${barRows(data.dayParts)}</article>
      <article class="feature-panel reveal"><h3>Days of Week</h3>${barRows(data.weekday, "day", "messages")}</article>
      <article class="feature-panel reveal"><h3>Message Types</h3>${barRows(data.messageTypes || [])}</article>
      <article class="feature-panel reveal"><h3>Lengths</h3>${barRows(data.lengthBuckets || [])}</article>
    </div>
  `;
}

function renderVoicesTab() {
  const maxMessages = Math.max(...Object.values(data.bySender).map((row) => row.messages));
  $("#tab-voices").innerHTML = `
    <div class="participant-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:24px; margin-bottom:32px;">
      ${Object.entries(data.bySender)
        .map(
          ([sender, row]) => `
            <article class="participant-card reveal">
              <span>Voice</span>
              <strong>${escapeHtml(shortName(sender))}</strong>
              <div class="bar-track" style="margin-bottom:24px;"><div class="bar-fill observe-bar" style="width:${pct(row.messages, maxMessages)}"></div></div>
              <div class="participant-metrics" style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                <div><span style="font-size:0.7rem; color:var(--text-muted);">Messages</span><br><b style="font-size:1.4rem;">${format(row.messages)}</b></div>
                <div><span style="font-size:0.7rem; color:var(--text-muted);">Words</span><br><b style="font-size:1.4rem;">${format(row.words)}</b></div>
                <div><span style="font-size:0.7rem; color:var(--text-muted);">Media</span><br><b style="font-size:1.4rem;">${format(row.media)}</b></div>
                <div><span style="font-size:0.7rem; color:var(--text-muted);">Questions</span><br><b style="font-size:1.4rem;">${format(row.questions)}</b></div>
              </div>
              <blockquote style="font-size:1.1rem; margin-top:24px;">"${escapeHtml(row.longestMessage.substring(0, 100))}..."</blockquote>
            </article>
          `,
        )
        .join("")}
    </div>
    
    <div class="split-grid">
      <article class="feature-panel wide reveal">
        <h3>Voices Over Time</h3>
        ${lineChart(data.monthly, { senderMode: true })}
        <div class="legend" style="display:flex; gap:16px; margin-top:16px;">
          ${data.participants.map((name, i) => `
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:12px; height:12px; border-radius:50%; background:${i===0?'#c9a96e':'#e8b4b8'}"></div>
              <span>${escapeHtml(shortName(name))}</span>
            </div>
          `).join("")}
        </div>
      </article>
    </div>
  `;
}

function emojiGrid(rows) {
  if (!rows || rows.length === 0) return "<p>No emojis</p>";
  return rows
    .map(
      (row) => `
        <div class="emoji-chip">
          <b>${escapeHtml(row.emoji)}</b>
          <span>${format(row.count)}</span>
        </div>
      `,
    )
    .join("");
}

function renderLanguageTab() {
  const topWords = data.topWords || [];
  const topPhrases = data.topPhrases || [];
  const topEmojis = data.topEmojis || [];
  const themes = data.themes || [];
  
  const topWordCount = topWords.length > 0 ? Math.max(...topWords.slice(0, 24).map((row) => row.count), 1) : 1;
  
  $("#tab-language").innerHTML = `
    <div class="language-grid">
      <article class="feature-panel reveal"><h3>Themes</h3>${barRows(themes)}</article>
      <article class="feature-panel reveal">
        <h3>Lexicon</h3>
        <div class="word-cloud">
          ${topWords
            .slice(0, 24)
            .map((row) => `<span class="word-chip" style="font-size:${(0.8 + (row.count / topWordCount) * 0.8).toFixed(2)}rem">${escapeHtml(row.text)}</span>`)
            .join("")}
        </div>
      </article>
      <article class="feature-panel reveal">
        <h3>Phrases</h3>
        <div class="phrase-list" style="display:flex; flex-direction:column; gap:12px;">
          ${topPhrases
            .map((row) => `<div class="phrase-chip" style="display:flex; justify-content:space-between;"><b>${escapeHtml(row.text)}</b><span style="color:var(--gold);">${format(row.count)}</span></div>`)
            .join("")}
        </div>
      </article>
      <article class="feature-panel reveal">
        <h3>Emoji Palette</h3>
        <div class="emoji-grid">${emojiGrid(topEmojis.slice(0, 20))}</div>
      </article>
    </div>
  `;
}

function renderMemoriesTab() {
  $("#tab-memories").innerHTML = `
    <div class="memory-layout">
      <div>
        <h3 style="color:var(--text); margin-bottom:24px; font-size:1.8rem; font-family:'Playfair Display', serif;">Milestones</h3>
        <div class="timeline-cards" style="display:flex; flex-direction:column; gap:32px;">
          ${(data.milestones || [])
            .map(
              (item) => `
                <article class="memory-card reveal" style="border-left: 2px solid var(--gold); border-radius: 0 16px 16px 0;">
                  <span style="color:var(--gold);">${escapeHtml(item.date)} &bull; ${escapeHtml(shortName(item.sender))}</span>
                  <h3 style="color:var(--text); font-size:1.3rem; margin-top:8px;">${escapeHtml(item.title)}</h3>
                  <blockquote>"${escapeHtml(item.sample)}"</blockquote>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
      <div>
        <h3 style="color:var(--text); margin-bottom:24px; font-size:1.8rem; font-family:'Playfair Display', serif;">Busiest Days</h3>
        <div class="memory-cards" style="display:flex; flex-direction:column; gap:24px;">
          ${(data.topDays || [])
            .map(
              (item) => `
                <article class="memory-card reveal">
                  <span style="color:var(--rose);">${escapeHtml(item.date)}</span>
                  <h3 style="margin:8px 0; font-size:2rem; color:var(--gold-light);">${format(item.messages)}<span style="font-size:1rem; font-family:'Inter',sans-serif; color:var(--text-muted);"> msgs</span></h3>
                  <p style="font-style:italic;">"${escapeHtml(item.sample)}" &mdash; ${escapeHtml(shortName(item.sampleSender))}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

/* --- ANIMATIONS & INTERACTIONS --- */

function animateValue(obj, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // ease out quad
    const easeProgress = progress * (2 - progress);
    obj.innerHTML = format(Math.floor(easeProgress * (end - start) + start));
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

function typeWriter(text, elementId, speed) {
  let i = 0;
  const el = document.getElementById(elementId);
  el.innerHTML = "";
  function type() {
    if (i < text.length) {
      el.innerHTML += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

function setupObservers() {
  const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
  
  // Reveal elements
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        
        // Trigger count-ups within this revealed element
        const counters = entry.target.querySelectorAll('.count-up');
        counters.forEach(counter => {
          if (!counter.dataset.counted) {
            animateValue(counter, 0, parseInt(counter.dataset.value), 2000);
            counter.dataset.counted = true;
          }
        });

        // Trigger path drawings
        const paths = entry.target.querySelectorAll('.line-path');
        paths.forEach(path => path.classList.add('drawn'));

        // Trigger bar animations
        const bars = entry.target.querySelectorAll('.observe-bar');
        bars.forEach(bar => bar.classList.add('drawn'));

        revealObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  $$(".reveal").forEach((item) => revealObserver.observe(item));
}

function setupTabs() {
  $$(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      $$(".tab-button").forEach((item) => item.classList.toggle("active", item === button));
      $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tab}`));
      
      // Re-trigger animations in the new active tab
      setTimeout(() => {
        const activePanel = $(`#tab-${tab}`);
        activePanel.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
        activePanel.querySelectorAll('.line-path').forEach(el => el.classList.add('drawn'));
        activePanel.querySelectorAll('.observe-bar').forEach(el => el.classList.add('drawn'));
      }, 50);
    });
  });
}

// Particle System
function setupCanvas() {
  const canvas = document.getElementById('canvas-container');
  const ctx = canvas.getContext('2d');
  
  let width, height;
  let particles = [];
  
  function resize() {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
  }
  
  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.size = Math.random() * 2 + 0.5;
      this.speedY = Math.random() * 0.5 + 0.1;
      this.speedX = (Math.random() - 0.5) * 0.2;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.type = Math.random() > 0.8 ? 'heart' : 'sparkle';
    }
    update() {
      this.y -= this.speedY;
      this.x += this.speedX;
      
      // Reset if out of bounds
      if (this.y < -10) {
        this.y = height + 10;
        this.x = Math.random() * width;
      }
    }
    draw() {
      ctx.globalAlpha = this.opacity;
      if (this.type === 'sparkle') {
        ctx.fillStyle = '#c9a96e';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Draw tiny heart
        ctx.fillStyle = '#e8b4b8';
        const s = this.size;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.bezierCurveTo(this.x, this.y - s*1.5, this.x - s*2, this.y - s*1.5, this.x - s*2, this.y);
        ctx.bezierCurveTo(this.x - s*2, this.y + s*1.5, this.x, this.y + s*2, this.x, this.y + s*3);
        ctx.bezierCurveTo(this.x, this.y + s*2, this.x + s*2, this.y + s*1.5, this.x + s*2, this.y);
        ctx.bezierCurveTo(this.x + s*2, this.y - s*1.5, this.x, this.y - s*1.5, this.x, this.y);
        ctx.fill();
      }
    }
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < 80; i++) {
      particles.push(new Particle());
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  resize();
  initParticles();
  animate();
}

function setupCursor() {
  const cursor = document.getElementById('cursor-glow');
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
}

function removePreloader() {
  const preloader = document.getElementById('preloader');
  setTimeout(() => {
    preloader.style.opacity = '0';
    setTimeout(() => {
      preloader.style.visibility = 'hidden';
      // Start Typewriter after preloader
      typeWriter(data.subtitle, "page-subtitle", 40);
    }, 1000);
  }, 1500); // Minimum preloader time
}

function init() {
  if (!data) {
    document.body.innerHTML = "<main class='hero'><h1>Analysis data missing</h1></main>";
    return;
  }
  
  // Render components
  renderOverview();
  renderStoryTab();
  renderRhythmTab();
  renderVoicesTab();
  renderLanguageTab();
  renderMemoriesTab();
  
  // Setup logic
  setupTabs();
  setupCanvas();
  setupCursor();
  
  // After DOM is rendered, setup observers
  setTimeout(() => {
    setupObservers();
    removePreloader();
  }, 100);
}

// Start
init();
