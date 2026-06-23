// ===== 第二代金钱卦 v1.7 =====

const YAO_VAL_LABEL = { 6:'六（老阴→阳）', 7:'七（少阳）', 8:'八（少阴）', 9:'九（老阳→阴）' };
const COMMENTATOR = { wangbi:'王弼·孔颖达', zhuxi:'朱熹', chengyi:'程颐', shaoyong:'邵雍', duanyitianji:'断易天机' };

let currentResult = null;
let historyData = [];
let divinating = false;
let manualChanges = null;
let skipHistoryAdd = false;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  setupInputs();
  document.getElementById('yao1').focus();
  // Ensure focus sticks after Electron window fully renders
  setTimeout(() => document.getElementById('yao1').focus(), 100);
  setupSearch();
  setupBianSelect();
  document.getElementById('divinate-btn').addEventListener('click', doDivination);
  document.getElementById('clear-btn').addEventListener('click', clearAll);
  document.getElementById('history-toggle').addEventListener('click', toggleHistory);
  document.getElementById('history-close').addEventListener('click', () => toggleHistory(false));
  document.getElementById('history-clear-all').addEventListener('click', clearHistory);
  document.getElementById('clear-cache-btn').addEventListener('click', clearAppCache);
  document.getElementById('notes-save').addEventListener('click', saveNote);
  document.getElementById('notes-cancel').addEventListener('click', closeNotes);
});

// ===== Input =====
function clearAll() {
  for (let i=1;i<=6;i++) { const inp = document.getElementById('yao'+i); inp.value=''; inp.classList.remove('filled','invalid'); }
  document.getElementById('yao1').focus();
  document.getElementById('results').style.display = 'none';
  document.getElementById('app').classList.remove('has-results');
}

function setupInputs() {
  const inputs = [];
  for (let i=1;i<=6;i++) inputs.push(document.getElementById('yao'+i));
  inputs.forEach((inp, idx) => {
    // 用 input 事件替代 keydown，避免 iOS 双击问题
    inp.addEventListener('input', function(e) {
      var raw = inp.value;
      var cleaned = raw.replace(/[^6-9]/g, '').slice(0, 1);
      if (!cleaned) { inp.value = ''; return; }
      inp.value = cleaned;
      inp.classList.add('filled');
      inp.classList.remove('invalid');
      if (idx < 5) {
        var next = inputs[idx + 1];
        setTimeout(function() { next.focus(); next.select(); }, 10);
      }
    });
    inp.addEventListener('paste', function(e) {
      e.preventDefault();
      var paste = (e.clipboardData ? e.clipboardData.getData('text') : '').replace(/\D/g, '').slice(0, 6);
      if (!/^[6-9]+$/.test(paste)) return;
      for (var j = 0; j < paste.length && j < 6; j++) {
        var t = document.getElementById('yao' + (j + 1));
        t.value = paste[j];
        t.classList.add('filled');
      }
      if (paste.length < 6) {
        var n = document.getElementById('yao' + (paste.length + 1));
        if (n) { setTimeout(function() { n.focus(); n.select(); }, 10); }
      }
    });
    inp.addEventListener('click', function() { inp.select(); });
  });
}

// ===== Divination =====
async function doDivination() {
  if (divinating) return;
  const lines = [];
  for (let i=1;i<=6;i++) {
    const v = parseInt(document.getElementById('yao'+i).value);
    if (![6,7,8,9].includes(v)) {
      document.getElementById('yao'+i).focus();
      document.getElementById('yao'+i).classList.add('invalid');
      setTimeout(() => document.getElementById('yao'+i).classList.remove('invalid'), 300);
      return;
    }
    lines.push(v);
  }
  var btn = document.getElementById('divinate-btn');
  var origHTML = btn.innerHTML;
  btn.innerHTML = '起卦中...';
  btn.disabled = true;
  divinating = true;
  try {
    const result = await window.zhouyiAPI.divinate(lines);
    currentResult = result;
    manualChanges = null;
    document.getElementById('results').style.display = '';
    document.getElementById('app').classList.add('has-results');
    render(result);
    if (!skipHistoryAdd) addToHistory(result);
    skipHistoryAdd = false;
  } finally {
    divinating = false;
    btn.innerHTML = origHTML;
    btn.disabled = false;
  }
}

// ===== Render =====
function render(r) {
  if (r.error) { alert('排盘出错：'+r.error); return; }

  // Force reset both cards before rendering
  document.getElementById('ben-card').style.display = '';
  document.getElementById('bian-card').style.display = '';
  document.getElementById('gua-arrow').style.display = '';
  document.getElementById('bian-title').style.display = '';
  document.getElementById('middle-col').style.display = '';

  renderGuaCard('ben', r.ben_gua, r.changing_yaos, false);
  renderGuaCard('bian', r.bian_gua, r.changing_yaos, true);

  // 之卦标题
  const titleEl = document.getElementById('bian-title');
  const arrowEl = document.getElementById('gua-arrow');
  if (r.changing_yaos.length > 0 && r.bian_gua) {
    titleEl.textContent = r.ben_gua.name + '之' + r.bian_gua.name + '卦';
    titleEl.style.display = '';
    arrowEl.style.display = '';
  } else {
    titleEl.textContent = r.ben_gua.name + '卦';
    titleEl.style.display = '';
    arrowEl.style.display = 'none';
  }

  renderRefBox(r);
}

function renderGuaCard(prefix, gua, changingYaos, isBian) {
  const card = document.getElementById(prefix+'-card');
  if (!gua) { card.style.display='none'; return; }
  card.style.display = '';

  document.getElementById(prefix+'-unicode').textContent = gua.unicode||'';
  document.getElementById(prefix+'-name').textContent = gua.fullName||gua.name;
  document.getElementById(prefix+'-number').textContent = `第${gua.id}卦 ${gua.upper||''}上${gua.lower||''}下`;
  document.getElementById(prefix+'-shiyi').textContent = gua.guaming_shiyi || '';

  // Guaci toggle (collapsed by default)
  const guaciToggle = document.getElementById(prefix+'-guaci-toggle');
  if (gua.guaci) {
    guaciToggle.style.display = '';
    guaciToggle.classList.remove('open');
    document.getElementById(prefix+'-guaci-body').innerHTML =
      `<span class="original">卦辞：${gua.guaci}</span>` +
      (gua.guaci_baihua ? `<span class="baihua">白话：${gua.guaci_baihua}</span>` : '');
    guaciToggle.querySelector('.guaci-toggle-btn').onclick = () => guaciToggle.classList.toggle('open');
  } else {
    guaciToggle.style.display = 'none';
  }

  // 彖传 toggle
  const tuanToggle = document.getElementById(prefix+'-tuan-toggle');
  if (gua.tuanzhuan) {
    tuanToggle.style.display = '';
    tuanToggle.classList.remove('open');
    document.getElementById(prefix+'-tuan-body').innerHTML =
      `<span class="original">《彖》曰：${gua.tuanzhuan}</span>` +
      (gua.tuanzhuan_baihua ? `<span class="baihua">白话：${gua.tuanzhuan_baihua}</span>` : '');
    tuanToggle.querySelector('.tuan-toggle-btn').onclick = () => tuanToggle.classList.toggle('open');
  } else {
    tuanToggle.style.display = 'none';
  }

  // 大象传 toggle
  const daxiangToggle = document.getElementById(prefix+'-daxiang-toggle');
  if (gua.daxiang) {
    daxiangToggle.style.display = '';
    daxiangToggle.classList.remove('open');
    document.getElementById(prefix+'-daxiang-body').innerHTML =
      `<span class="original">《象》曰：${gua.daxiang}</span>`;
    daxiangToggle.querySelector('.daxiang-toggle-btn').onclick = () => daxiangToggle.classList.toggle('open');
  } else {
    daxiangToggle.style.display = 'none';
  }

  // Get 世爻/应爻 positions
  const bagong = gua.bagong || {};
  const shiPos = bagong.shiyao || 0;
  const yingPos = bagong.yingyao || 0;

  // Lines with click-to-expand yaoci
  const container = document.getElementById(prefix+'-lines');
  container.innerHTML = '';
  const display = gua.lines_display || [];
  for (let i = display.length-1; i >= 0; i--) {
    const line = display[i];
    const pos = line.position;
    const isChanging = !isBian && changingYaos.includes(pos);
    const isChanged = isBian && changingYaos.includes(pos);
    const isShi = (pos === shiPos);
    const isYing = (pos === yingPos);
    const yaoName = line.name;

    // Get yaoci + xiaoxiang
    let yaoOrig = '', yaoBai = '', yaoXiao = '';
    if (gua.yaoci_parsed) {
      const f = gua.yaoci_parsed.find(y => y.name && y.name.trim() === yaoName.trim());
      if (f) { yaoOrig = f.text; yaoXiao = f.xiaoxiang || ''; }
    }
    if (gua.yao_baihua && gua.yao_baihua[yaoName]) yaoBai = gua.yao_baihua[yaoName];

    const row = document.createElement('div');
    row.className = 'gua-line-row';
    if (isChanging) row.classList.add('changing');
    if (isChanged) row.classList.add('changed');
    // All collapsed by default - no 'open' class initially

    const main = document.createElement('div');
    main.className = 'gua-line-main';

    // Left: expand + marker
    const left = document.createElement('div');
    left.className = 'gua-line-left';
    const expand = document.createElement('span');
    expand.className = 'expand-icon';
    expand.textContent = '▶';
    left.appendChild(expand);
    if (isChanging) {
      const m = document.createElement('span'); m.className='change-marker'; m.textContent='✦'; left.appendChild(m);
    }
    if (isChanged) {
      const m = document.createElement('span'); m.className='change-marker'; m.textContent='⟳'; left.appendChild(m);
    }
    main.appendChild(left);

    // Center: bar (wrapped for centering)
    const barWrap = document.createElement('div');
    barWrap.className = 'gua-line-bar-wrap';
    if (line.isYang) {
      const bar = document.createElement('div'); bar.className='yang-bar'; barWrap.appendChild(bar);
    } else {
      const yb = document.createElement('div'); yb.className='yin-bar';
      yb.appendChild(Object.assign(document.createElement('div'),{className:'half'}));
      yb.appendChild(Object.assign(document.createElement('div'),{className:'half'}));
      barWrap.appendChild(yb);
    }
    main.appendChild(barWrap);

    // Right: yao name + shi/ying
    const right = document.createElement('div');
    right.className = 'gua-line-right';
    const tag = document.createElement('span');
    tag.className = 'yao-tag';
    let tagText = yaoName + (isChanging?' ←变':'');
    if (isShi) tagText += ' ·世';
    if (isYing) tagText += ' ·应';
    tag.textContent = tagText;
    if (isShi) tag.classList.add('has-shi');
    if (isYing) tag.classList.add('has-ying');
    right.appendChild(tag);
    main.appendChild(right);

    // Click to toggle expand, Shift+click to toggle changing yao
    main.addEventListener('click', (e) => {
      if (e.shiftKey && currentResult) {
        e.stopPropagation();
        toggleManualChange(pos);
        return;
      }
      row.classList.toggle('open');
      expand.textContent = row.classList.contains('open') ? '▼' : '▶';
    });

    row.appendChild(main);

    // Detail dropdown
    const drop = document.createElement('div');
    drop.className = 'yao-detail-drop';
    if (yaoOrig) {
      drop.innerHTML = `<span class="yao-original">爻辞：${yaoOrig}</span>` +
        (yaoXiao ? `<br><span class="yao-xiaoxiang">《象》曰：${yaoXiao}</span>` : '') +
        (yaoBai ? `<br><span class="yao-baihua">白话：${yaoBai}</span>` : '');
    } else {
      drop.innerHTML = '<span style="color:var(--text-muted);">（暂无爻辞）</span>';
    }
    row.appendChild(drop);

    container.appendChild(row);
  }
}

// ===== Render Reference Box — 朱熹考变占法 =====
function renderRefBox(r) {
  const box = document.getElementById('ref-box');
  const num = r.changing_yaos.length;
  // Helper: get yao text + baihua from hexagram data
  function getYaoText(gua, pos) {
    const line = gua.lines_display.find(l => l.position === pos);
    if (!line) return { text: '', baihua: '' };
    const name = line.name;
    let text = '', baihua = '';
    if (gua.yaoci_parsed) {
      const f = gua.yaoci_parsed.find(y => y.name && y.name.trim() === name.trim());
      if (f) text = f.text;
    }
    if (gua.yao_baihua && gua.yao_baihua[name]) baihua = gua.yao_baihua[name];
    return { text: name + '：' + text, baihua };
  }

  let ruleHtml = '', textHtml = '', baihuaHtml = '';

  if (num === 0) {
    ruleHtml = '静卦<br><b>占本卦卦辞</b>';
    textHtml = r.ben_gua.guaci || '';
    baihuaHtml = r.ben_gua.guaci_baihua || '';

  } else if (num === 1) {
    const pos = r.changing_yaos[0];
    const line = r.ben_gua.lines_display.find(l => l.position === pos);
    const nm = line ? line.name : '?';
    ruleHtml = `一爻变<br><b>占本卦${nm}爻辞</b>`;
    const yt = getYaoText(r.ben_gua, pos);
    textHtml = yt.text; baihuaHtml = yt.baihua;

  } else if (num === 2) {
    const sorted = [...r.changing_yaos].sort((a,b) => a-b);
    const lo = sorted[0], hi = sorted[1];
    const loLine = r.ben_gua.lines_display.find(l => l.position === lo);
    const hiLine = r.ben_gua.lines_display.find(l => l.position === hi);
    const loNm = loLine?loLine.name:'?', hiNm = hiLine?hiLine.name:'?';
    ruleHtml = `二爻变：<b>${loNm}、${hiNm}</b><br>占两变爻，以上爻为主`;
    const ytHi = getYaoText(r.ben_gua, hi);
    const ytLo = getYaoText(r.ben_gua, lo);
    textHtml = (hiLine ? '【主】' + ytHi.text : '') + '\n' + (loLine ? '【次】' + ytLo.text : '');
    baihuaHtml = ytHi.baihua || ytLo.baihua;

  } else if (num === 3) {
    const yaos = r.changing_yaos.map(p => {
      const l = r.ben_gua.lines_display.find(x => x.position === p);
      return l ? l.name : '?';
    }).join('、');
    ruleHtml = `三爻变：<b>${yaos}</b><br>占本卦+变卦卦辞`;
    textHtml = '【本卦】' + (r.ben_gua.guaci||'') + '\n【变卦】' + (r.bian_gua ? r.bian_gua.guaci||'' : '');
    baihuaHtml = r.ben_gua.guaci_baihua || '';

  } else if (num === 4) {
    const yaos = r.changing_yaos.map(p => {
      const l = r.ben_gua.lines_display.find(x => x.position === p);
      return l ? l.name : '?';
    }).join('、');
    const unchanged = [1,2,3,4,5,6].filter(p => !r.changing_yaos.includes(p));
    const lo = unchanged[0], hi = unchanged[1];
    const loNm = r.bian_gua?.lines_display?.find(l=>l.position===lo)?.name||'?';
    const hiNm = r.bian_gua?.lines_display?.find(l=>l.position===hi)?.name||'?';
    ruleHtml = `四爻变：<b>${yaos}</b><br>占变卦不变爻${loNm}、${hiNm}，以下爻为主`;
    const ytLo = r.bian_gua ? getYaoText(r.bian_gua, lo) : {text:'',baihua:''};
    const ytHi = r.bian_gua ? getYaoText(r.bian_gua, hi) : {text:'',baihua:''};
    textHtml = '【主】' + ytLo.text + '\n【次】' + ytHi.text;
    baihuaHtml = ytLo.baihua || ytHi.baihua;

  } else if (num === 5) {
    const yaos = r.changing_yaos.map(p => {
      const l = r.ben_gua.lines_display.find(x => x.position === p);
      return l ? l.name : '?';
    }).join('、');
    const ui = [1,2,3,4,5,6].find(p => !r.changing_yaos.includes(p));
    const uiNm = r.bian_gua?.lines_display?.find(l=>l.position===ui)?.name||'?';
    ruleHtml = `五爻变：<b>${yaos}</b><br>占变卦唯一不变爻${uiNm}`;
    const yt = r.bian_gua ? getYaoText(r.bian_gua, ui) : {text:'',baihua:''};
    textHtml = yt.text; baihuaHtml = yt.baihua;

  } else { // num === 6
    if (r.ben_gua.id === 1) {
      ruleHtml = '六爻全变（乾之坤）<br><b>占用九</b>';
      textHtml = '用九：见群龙无首，吉。';
    } else if (r.ben_gua.id === 2) {
      ruleHtml = '六爻全变（坤之乾）<br><b>占用六</b>';
      textHtml = '用六：利永贞。';
    } else {
      ruleHtml = '六爻全变<br><b>占变卦卦辞</b>';
      textHtml = r.bian_gua ? r.bian_gua.guaci||'' : '';
      baihuaHtml = r.bian_gua ? r.bian_gua.guaci_baihua||'' : '';
    }
  }

  box.innerHTML =
    `<div class="ref-rule">${ruleHtml}</div>` +
    (textHtml ? `<div class="ref-text">${textHtml.replace(/\n/g, '<br>')}</div>` : '') +
    (baihuaHtml ? `<div class="ref-baihua">白话：${baihuaHtml}</div>` : '');
}

// ===== 之卦直查 【本卦】之【之卦】 =====
function findGuaId(q, all) {
  if (!q) return null;
  const num = parseInt(q);
  if (!isNaN(num) && num >= 1 && num <= 64) return num;
  for (const key of Object.keys(all)) {
    const h = all[key];
    if (h.name === q) return h.id;
    if (h.fullName && h.fullName.includes(q)) return h.id;
  }
  return null;
}

function setupBianSelect() {
  const benInp = document.getElementById('zhi-ben');
  const bianInp = document.getElementById('zhi-bian');

  async function doZhiGua() {
    try {
      const benQ = benInp.value.trim();
      const bianQ = bianInp.value.trim();
      if (!benQ && !bianQ) return;

      const all = await window.zhouyiAPI.getAllHexagrams();
      if (!all) return;

      // If only 之卦 given, show as static
      if (!benQ && bianQ) {
        const targetId = findGuaId(bianQ, all);
        if (!targetId) return;
        const targetGua = all[targetId];
        if (!targetGua || !targetGua.lines) return;
        const fakeLines = targetGua.lines.map(v => v ? 7 : 8);
        const result = await window.zhouyiAPI.divinate(fakeLines);
        if (!result || result.error) return;
        currentResult = result; manualChanges = null;
        document.getElementById('results').style.display = '';
        document.getElementById('app').classList.add('has-results');
        for (let i = 0; i < 6; i++) {
          const inp = document.getElementById('yao'+(i+1));
          if (inp) { inp.value = fakeLines[i]; inp.classList.add('filled'); }
        }
        benInp.value = ''; bianInp.value = '';
        render(result); return;
      }

      const benId = findGuaId(benQ, all);
      if (!benId) return;
      const benGua = all[benId];
      if (!benGua || !benGua.lines) return;

      const benLines = benGua.lines.map(v => v ? 7 : 8);

      if (bianQ) {
        const bianId = findGuaId(bianQ, all);
        if (!bianId) return;
        const bianGua = all[bianId];
        if (!bianGua || !bianGua.lines) return;
        manualChanges = new Set();
        for (let i = 0; i < 6; i++) {
          if (benGua.lines[i] !== bianGua.lines[i]) manualChanges.add(i + 1);
        }
      } else { manualChanges = null; }

      const result = await window.zhouyiAPI.divinate(benLines);
      if (!result || result.error) return;
      currentResult = result;
      document.getElementById('results').style.display = '';
      document.getElementById('app').classList.add('has-results');
      for (let i = 0; i < 6; i++) {
        const inp = document.getElementById('yao'+(i+1));
        if (inp) { inp.value = benLines[i]; inp.classList.add('filled'); }
      }
      benInp.value = ''; bianInp.value = '';

      if (manualChanges && manualChanges.size > 0) { await recalcAndRender(); }
      else { render(result); }
    } catch(e) {}
  }

  benInp.addEventListener('keydown', e => { if (e.key === 'Enter') doZhiGua(); });
  bianInp.addEventListener('keydown', e => { if (e.key === 'Enter') doZhiGua(); });
}

// ===== Manual yao change (Shift+click) =====
function toggleManualChange(pos) {
  if (!currentResult || currentResult.error) return;
  if (!manualChanges) {
    manualChanges = new Set(currentResult.changing_yaos);
  }
  if (manualChanges.has(pos)) manualChanges.delete(pos);
  else manualChanges.add(pos);
  recalcAndRender();
}

async function recalcAndRender() {
  if (!currentResult || currentResult.error) return;
  const newChanges = Array.from(manualChanges).sort((a,b) => a-b);
  const originalLines = currentResult.input_lines;

  const newBianLines = originalLines.map((v, i) => {
    const benYang = (v === 7 || v === 9);
    return manualChanges.has(i + 1) ? !benYang : benYang;
  });

  // Find bian gua
  const allHexagrams = await window.zhouyiAPI.getAllHexagrams();
  let bianId = null;
  if (manualChanges.size > 0) {
    for (const key of Object.keys(allHexagrams)) {
      const h = allHexagrams[key];
      if (h.lines && h.lines.length === 6 && h.lines.every((v, i) => v === newBianLines[i])) {
        bianId = parseInt(key); break;
      }
    }
  }

  const bianHexagram = bianId ? await window.zhouyiAPI.getHexagram(bianId) : null;

  // Update ben gua lines_display with manual changes
  const benDisplay = currentResult.ben_gua.lines_display.map(l => ({
    ...l,
    isChanging: manualChanges.has(l.position)
  }));

  // Build updated result
  const updated = {
    ...currentResult,
    ben_gua: {
      ...currentResult.ben_gua,
      lines_display: benDisplay
    },
    bian_gua: bianHexagram ? {
      id: bianId,
      ...bianHexagram,
      lines_display: newBianLines.map((isYang, i) => ({
        position: i + 1,
        name: getYaoNameLocal(isYang, i + 1),
        isYang,
        isChanged: manualChanges.has(i + 1),
        originalValue: originalLines[i]
      }))
    } : null,
    changing_yaos: newChanges,
    num_changes: manualChanges.size
  };

  // Update reference and rule
  const ruleDesc = manualChanges.size === 0 ? '静卦' :
    (manualChanges.size === 1 ? `一爻变` : `${manualChanges.size}爻变`);
  updated.reference = ruleDesc;

  currentResult = updated;
  render(updated);
}

function getYaoNameLocal(isYang, pos) {
  const yao = isYang ? '九' : '六';
  if (pos === 1) return '初' + yao;
  if (pos === 6) return '上' + yao;
  const names = { 2: '二', 3: '三', 4: '四', 5: '五' };
  return yao + names[pos];
}

// ===== Hexagram Search =====
function setupSearch() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  let allHexagrams = null;

  input.addEventListener('focus', async () => {
    if (!allHexagrams) allHexagrams = await window.zhouyiAPI.getAllHexagrams();
    if (input.value) filterResults();
  });

  input.addEventListener('input', async () => {
    if (!allHexagrams) allHexagrams = await window.zhouyiAPI.getAllHexagrams();
    filterResults();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { results.style.display = 'none'; }, 200);
  });

  function filterResults() {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.style.display = 'none'; return; }

    const matches = [];
    for (const key of Object.keys(allHexagrams)) {
      const h = allHexagrams[key];
      const name = h.fullName || h.name;
      // Match by id, name, or fullName
      if (key === q || name.includes(q) || h.name.includes(q) ||
          (h.upper && h.upper.includes(q)) || (h.lower && h.lower.includes(q))) {
        matches.push(h);
      }
    }

    if (matches.length === 0) {
      results.innerHTML = '<div class="search-result-item" style="color:var(--text-muted);">无匹配结果</div>';
    } else {
      results.innerHTML = matches.slice(0, 10).map(h => `
        <div class="search-result-item" data-id="${h.id}">
          <span class="sr-unicode">${h.unicode||''}</span>
          <span class="sr-name">${h.fullName||h.name}</span>
          <span class="sr-num">第${h.id}卦</span>
        </div>
      `).join('');
    }
    results.style.display = '';
  }

  results.addEventListener('click', async (e) => {
    const item = e.target.closest('.search-result-item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    const gua = await window.zhouyiAPI.getHexagram(id);
    if (!gua) return;

    // Display as static hexagram
    const fakeLines = gua.lines.map(v => v ? 7 : 8); // all static
    const result = await window.zhouyiAPI.divinate(fakeLines);
    currentResult = result;
    manualChanges = null;
    document.getElementById('results').style.display = '';
    document.getElementById('app').classList.add('has-results');
    // Fill inputs with the lines
    for (let i = 0; i < 6; i++) {
      const inp = document.getElementById('yao' + (i+1));
      if (inp) { inp.value = fakeLines[i]; inp.classList.add('filled'); }
    }
    render(result);

    input.value = '';
    results.style.display = 'none';
  });
}

// ===== History =====
function loadHistory() {
  try { historyData = JSON.parse(localStorage.getItem('zhouyi_history')||'[]'); } catch(e) { historyData = []; }
  renderHistoryList();
}
function saveHistory() {
  localStorage.setItem('zhouyi_history', JSON.stringify(historyData));
  renderHistoryList();
}
function addToHistory(result) {
  const entry = {
    id: Date.now(),
    time: new Date().toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),
    lines: result.input_lines.join(''),
    benName: result.ben_gua.fullName||result.ben_gua.name,
    benId: result.ben_gua.id,
    bianName: result.bian_gua ? (result.bian_gua.fullName||result.bian_gua.name) : '静卦',
    bianId: result.bian_gua ? result.bian_gua.id : null,
    changingYaos: result.changing_yaos,
    numChanges: result.num_changes,
    note: ''
  };
  historyData.unshift(entry);
  if (historyData.length > 50) historyData = historyData.slice(0, 50);
  saveHistory();
}
function renderHistoryList() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  if (historyData.length === 0) { list.innerHTML=''; empty.style.display=''; return; }
  empty.style.display='none';
  list.innerHTML = historyData.map((h,i) => `
    <div class="history-item" data-idx="${i}">
      <div class="hi-time">${h.time}</div>
      <div class="hi-title">${h.benName}${h.bianName!=='静卦'?' → '+h.bianName:''}</div>
      <div class="hi-lines">${h.lines} | ${h.numChanges}爻动</div>
      ${h.note ? `<div class="hi-note">📝 备注</div><div class="hi-note-text">${h.note}</div>` : ''}
      <div class="hi-btns">
        <button class="hi-btn load">查看此卦</button>
        <button class="hi-btn note">${h.note?'编辑备注':'添加备注'}</button>
        <button class="hi-btn del">删除</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.history-item').forEach(item => {
    const idx = parseInt(item.dataset.idx);
    item.querySelector('.load').addEventListener('click', e => { e.stopPropagation(); loadHistoryEntry(idx); });
    item.querySelector('.note').addEventListener('click', e => { e.stopPropagation(); openNotes(idx); });
    item.querySelector('.del').addEventListener('click', e => {
      e.stopPropagation(); if (confirm('删除这条记录？')) { historyData.splice(idx,1); saveHistory(); }
    });
    const noteToggle = item.querySelector('.hi-note');
    if (noteToggle) {
      noteToggle.addEventListener('click', e => { e.stopPropagation(); noteToggle.classList.toggle('open'); });
    }
  });
}
function loadHistoryEntry(idx) {
  const h = historyData[idx]; if (!h) return;
  const digits = h.lines.split('').map(Number);
  for (let i=0;i<6;i++) {
    const inp = document.getElementById('yao'+(i+1));
    if (inp) { inp.value = digits[i]||''; inp.classList.add('filled'); }
  }
  toggleHistory(false); skipHistoryAdd = true; doDivination();
}
let editingIdx = null;
function openNotes(idx) {
  editingIdx = idx;
  document.getElementById('notes-textarea').value = historyData[idx].note || '';
  document.getElementById('notes-modal').style.display = '';
}
function closeNotes() { document.getElementById('notes-modal').style.display = 'none'; editingIdx = null; }
function saveNote() {
  if (editingIdx !== null) { historyData[editingIdx].note = document.getElementById('notes-textarea').value.trim(); saveHistory(); }
  closeNotes();
}
function clearHistory() { if (confirm('确定清空全部历史记录？')) { historyData = []; saveHistory(); } }
async function clearAppCache() {
  try {
    const r = await window.zhouyiAPI.clearCache();
    if (r.success) alert('缓存已清除');
    else alert('清除失败：' + (r.error || '未知错误'));
  } catch(e) {
    alert('清除缓存失败：' + e.message);
  }
}
function toggleHistory(force) {
  const panel = document.getElementById('history-panel');
  const btn = document.getElementById('history-toggle');
  const show = typeof force==='boolean' ? force : panel.style.display==='none';
  panel.style.display = show ? '' : 'none';
  btn.classList.toggle('active', show);
  if (show) renderHistoryList();
}

// ===== Floating copy button =====
document.addEventListener('mouseup', () => {
  const sel = window.getSelection();
  const float = document.getElementById('copy-float');
  if (!sel || sel.toString().trim().length === 0) {
    float.style.display = 'none'; return;
  }
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  float.style.display = '';
  float.style.left = (rect.left + rect.width/2 - 20) + 'px';
  float.style.top = (rect.top - 30) + 'px';
  float.classList.remove('copied');
  float.textContent = '复制';
});
document.addEventListener('mousedown', (e) => {
  if (e.target.id !== 'copy-float') {
    document.getElementById('copy-float').style.display = 'none';
  }
});
document.getElementById('copy-float').addEventListener('click', () => {
  const text = window.getSelection().toString();
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      const float = document.getElementById('copy-float');
      float.textContent = '已复制';
      float.classList.add('copied');
      setTimeout(() => { float.style.display = 'none'; }, 800);
    }).catch(() => {});
  }
});
