// data.js — 浏览器原生数据层，替代 Electron preload/IPC 桥接
// 提供与 window.zhouyiAPI 完全相同的接口，app.js 无需任何修改
(function() {
  let hexagramData = null;
  let initPromise = null;

  function loadData() {
    if (hexagramData) return Promise.resolve(hexagramData);
    if (!initPromise) {
      initPromise = fetch('data/hexagrams.json')
        .then(r => { if (!r.ok) throw new Error('数据加载失败'); return r.json(); })
        .then(data => { hexagramData = data; return data; })
        .catch(err => { initPromise = null; throw err; });
    }
    return initPromise;
  }

  function findHexagramByLines(target, data) {
    for (const key of Object.keys(data.hexagrams)) {
      const h = data.hexagrams[key];
      if (h.lines && h.lines.length === 6 &&
          h.lines.every((v, i) => v === target[i])) {
        return parseInt(key);
      }
    }
    return null;
  }

  function getYaoName(isYang, pos) {
    const yao = isYang ? '九' : '六';
    if (pos === 1) return '初' + yao;
    if (pos === 6) return '上' + yao;
    const names = { 2: '二', 3: '三', 4: '四', 5: '五' };
    return yao + names[pos];
  }

  function performDivination(lines, data) {
    const benLines = lines.map(v => v === 7 || v === 9);
    const changingYaos = [];
    lines.forEach((v, i) => {
      if (v === 6 || v === 9) changingYaos.push(i + 1);
    });

    const benId = findHexagramByLines(benLines, data);
    if (!benId) return { error: '无法识别本卦' };

    const bianLines = lines.map(v => {
      if (v === 6) return true;
      if (v === 9) return false;
      return v === 7;
    });

    const bianId = (changingYaos.length > 0)
      ? findHexagramByLines(bianLines, data)
      : null;

    const benHexagram = data.hexagrams[benId];
    const bianHexagram = (bianId && data.hexagrams[bianId]) ? data.hexagrams[bianId] : null;

    const numChanges = changingYaos.length;
    const rule = data.zhuxi_rules && data.zhuxi_rules.rules
      ? data.zhuxi_rules.rules[numChanges.toString()]
      : { desc: numChanges + '爻变' };

    let reference = '';
    let referenceDetail = '';

    if (numChanges === 0) {
      reference = '本卦卦辞';
      referenceDetail = benHexagram.guaci;
    } else if (numChanges === 1) {
      const yaoPos = changingYaos[0];
      const yaoName = getYaoName(benLines[yaoPos - 1], yaoPos);
      reference = `本卦变爻（${yaoName}）爻辞`;
      referenceDetail = `占本卦${yaoName}爻辞`;
    } else if (numChanges === 2) {
      reference = '本卦两变爻爻辞（以上爻为主）';
      const upperYao = Math.max(...changingYaos);
      referenceDetail = `主看第${upperYao}爻`;
    } else if (numChanges === 3) {
      reference = '本卦及之卦彖辞（卦辞）';
      const chuChanged = changingYaos.includes(1);
      if (chuChanged) {
        referenceDetail = '前十卦：主贞（本卦）';
      } else {
        referenceDetail = '后十卦：主悔（变卦）';
      }
    } else if (numChanges === 4) {
      reference = '之卦两不变爻爻辞（以下爻为主）';
      const unchanged = [1,2,3,4,5,6].filter(p => !changingYaos.includes(p));
      referenceDetail = `不变爻：${unchanged.join(',')}，主看第${unchanged[0]}爻`;
    } else if (numChanges === 5) {
      reference = '之卦不变爻爻辞';
      const unchanged = [1,2,3,4,5,6].find(p => !changingYaos.includes(p));
      referenceDetail = `唯一不变爻：第${unchanged}爻`;
    } else {
      if (benId === 1) {
        reference = '乾占用九：群龙无首吉';
      } else if (benId === 2) {
        reference = '坤占用六：利永贞';
      } else {
        reference = '占之卦彖辞（卦辞）';
        referenceDetail = bianHexagram ? bianHexagram.guaci : '';
      }
    }

    return {
      ben_gua: {
        id: benId,
        ...benHexagram,
        lines_display: benLines.map((isYang, i) => ({
          position: i + 1,
          name: getYaoName(isYang, i + 1),
          isYang,
          isChanging: changingYaos.includes(i + 1),
          originalValue: lines[i]
        }))
      },
      bian_gua: bianHexagram ? {
        id: bianId,
        ...bianHexagram,
        lines_display: bianLines.map((isYang, i) => ({
          position: i + 1,
          name: getYaoName(isYang, i + 1),
          isYang,
          isChanged: changingYaos.includes(i + 1),
          originalValue: lines[i]
        }))
      } : null,
      changing_yaos: changingYaos,
      num_changes: numChanges,
      zhuxi_rule: rule,
      reference: reference,
      reference_detail: referenceDetail,
      input_lines: lines
    };
  }

  // 立即预加载数据，避免首次起卦时等待
  loadData();

  // 暴露与 Electron preload 完全相同的 API
  window.zhouyiAPI = {
    getHexagram: function(id) {
      return loadData().then(function(data) {
        return data.hexagrams[id] || null;
      });
    },
    getAllHexagrams: function() {
      return loadData().then(function(data) {
        return data.hexagrams;
      });
    },
    getBagua: function() {
      return loadData().then(function(data) {
        return data.bagua;
      });
    },
    getZhuxiRules: function() {
      return loadData().then(function(data) {
        return data.zhuxi_rules;
      });
    },
    divinate: function(lines) {
      return loadData().then(function(data) {
        return performDivination(lines, data);
      });
    },
    clearCache: function() {
      if ('caches' in window) {
        return caches.keys().then(function(names) {
          return Promise.all(names.map(function(n) { return caches.delete(n); }));
        }).then(function() {
          return { success: true };
        }).catch(function(e) {
          return { success: false, error: e.message };
        });
      }
      return Promise.resolve({ success: true });
    }
  };
})();
