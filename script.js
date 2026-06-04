/* ── Formatters ── */
const fmt = n => '₩' + Math.round(n).toLocaleString('ko-KR');

/**
 * 숫자를 축약 표기 (억/만) + 원화 기호
 * 결과 카드에서 긴 숫자가 잘리지 않도록 사용
 */
const fmtCompact = n => {
  const v = Math.round(n);
  if (v >= 1_000_000_000_000) return '₩' + (v / 1_000_000_000_000).toFixed(1) + '조';
  if (v >= 100_000_000)       return '₩' + (v / 100_000_000).toFixed(1) + '억';
  if (v >= 10_000)            return '₩' + Math.round(v / 10_000) + '만';
  return '₩' + v.toLocaleString('ko-KR');
};

const fmtShort = n => {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억';
  if (n >= 10_000)      return Math.round(n / 10_000) + '만';
  return Math.round(n).toLocaleString('ko-KR');
};

/* ── Calculation ── */
function calc() {
  const P   = parseFloat(document.getElementById('initial').value) || 0;
  const pmt = parseFloat(document.getElementById('monthly').value) || 0;
  const r   = parseFloat(document.getElementById('rate').value)    / 100 || 0;
  const yrs = parseInt(document.getElementById('years').value)     || 1;
  const n   = parseInt(document.getElementById('compound').value);

  const rn   = r / n;
  const data = [];

  // 월 납입 기준으로 월 이자율 환산
  // 복리 주기 n으로 연이율 r이 적용될 때, 실질 월 이자율 계산
  const monthlyRate = Math.pow(1 + rn, n / 12) - 1;

  for (let y = 1; y <= yrs; y++) {
    const months    = y * 12;
    const periods   = y * n;
    const principal = P + pmt * months;
    // 초기 투자금의 미래가치
    let total = P * Math.pow(1 + rn, periods);
    // 월 적립금의 미래가치 (등비급수 공식)
    if (monthlyRate > 0) {
      total += pmt * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
    } else {
      total += pmt * months;
    }
    data.push({ year: y, total, principal, interest: total - principal });
  }

  return { data, P, pmt, r, yrs, n };
}

/* ── State ── */
let chart   = null;
let showAll = false;
let lastData = null;

/* ── Toggle Table ── */
function toggleTable() {
  showAll = !showAll;
  const btn = document.getElementById('toggle-btn');
  btn.classList.toggle('open', showAll);
  btn.innerHTML =
    (showAll ? '접기' : '전체 내역 보기') +
    `<svg width="12" height="8" viewBox="0 0 12 8" fill="none">
       <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
     </svg>`;
  updateTable(lastData);
}

/* ── Main Update ── */
function update() {
  const { data, P, pmt } = calc();
  lastData = data;

  const last           = data[data.length - 1];
  const totalInvested  = last.principal;
  const totalInterest  = last.interest;
  const totalFinal     = last.total;
  const returnPct      = totalInvested > 0 ? (totalFinal / totalInvested - 1) * 100 : 0;
  const interestPct    = totalFinal    > 0 ? (totalInterest / totalFinal    * 100) : 0;

  /* 결과 카드 — 값이 클 때 축약 표기 사용 */
  document.getElementById('r-total').textContent    = fmtCompact(totalFinal);
  document.getElementById('r-invested').textContent = fmtCompact(totalInvested);
  document.getElementById('r-interest').textContent = fmtCompact(totalInterest);

  document.getElementById('r-return').textContent       = '수익률 +' + returnPct.toFixed(1) + '%';
  document.getElementById('r-invested-sub').textContent = '초기 ' + fmtShort(P) + ' + 월 ' + fmtShort(pmt);
  document.getElementById('r-interest-pct').textContent = '자산 대비 ' + interestPct.toFixed(1) + '%';

  updateChart(data);
  updateTable(data);
}

/* ── Chart ── */
function updateChart(data) {
  const labels     = data.map(d => d.year + '년');
  const principals = data.map(d => Math.round(d.principal));
  const interests  = data.map(d => Math.round(d.interest));

  if (chart) {
    chart.data.labels                 = labels;
    chart.data.datasets[0].data      = principals;
    chart.data.datasets[1].data      = interests;
    chart.update('active');
    return;
  }

  chart = new Chart(document.getElementById('growthChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '납입 원금', data: principals, stack: 'a',
          backgroundColor: 'rgba(78,205,196,0.55)',
          borderColor:     'rgba(78,205,196,0.8)',
          borderWidth: 1
        },
        {
          label: '복리 수익', data: interests, stack: 'a',
          backgroundColor: 'rgba(212,168,75,0.55)',
          borderColor:     'rgba(212,168,75,0.8)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e2230',
          borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
          titleColor: '#9099b0', bodyColor: '#e8eaf0',
          titleFont: { family: 'DM Mono', size: 11 },
          bodyFont:  { family: 'DM Mono', size: 12 },
          padding: 12,
          callbacks: {
            title: items => items[0].label,
            label: ctx  => ` ${ctx.dataset.label}: ₩${ctx.raw.toLocaleString('ko-KR')}`,
            afterBody: items => {
              const total = items[0].chart.data.datasets
                .reduce((s, ds) => s + (ds.data[items[0].dataIndex] || 0), 0);
              return ['', ` 합계: ₩${total.toLocaleString('ko-KR')}`];
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5a637a', font: { family: 'DM Mono', size: 11 },
            maxRotation: 0, autoSkip: true, maxTicksLimit: 12
          }
        },
        y: {
          stacked: true,
          grid:   { color: 'rgba(255,255,255,0.04)' },
          border: { dash: [4, 4] },
          ticks: {
            color: '#5a637a', font: { family: 'DM Mono', size: 10 },
            callback: v => {
              if (v >= 100_000_000) return (v / 100_000_000).toFixed(0) + '억';
              if (v >= 10_000)      return (v / 10_000).toFixed(0) + '만';
              return v;
            }
          }
        }
      }
    }
  });
}

/* ── Table ── */
function getVisibleRows(data) {
  if (showAll) return data;
  return data.filter((_, i) =>
    i % Math.max(1, Math.floor(data.length / 10)) === 0 || i === data.length - 1
  );
}

function updateTable(data) {
  const rows = getVisibleRows(data);

  /* 데스크톱 테이블 */
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = rows.map(d => {
    const pct = d.principal > 0 ? ((d.total / d.principal - 1) * 100).toFixed(1) : '0.0';
    return `<tr>
      <td>${d.year}년차</td>
      <td class="highlight">${fmt(d.total)}</td>
      <td class="teal">${fmt(d.principal)}</td>
      <td>${fmt(d.interest)}</td>
      <td>+${pct}%</td>
    </tr>`;
  }).join('');

  /* 모바일 카드 */
  const mc = document.getElementById('mobile-cards');
  mc.innerHTML = rows.map(d => {
    const pct = d.principal > 0 ? ((d.total / d.principal - 1) * 100).toFixed(1) : '0.0';
    return `<div class="m-card">
      <div class="m-card-header">
        <span class="m-year">${d.year}년차</span>
        <span class="m-pct">+${pct}%</span>
      </div>
      <div class="m-total">${fmtCompact(d.total)}</div>
      <div class="m-row">
        <span>납입금 <span class="vt">${fmtCompact(d.principal)}</span></span>
        <span>수익금 <span class="v">${fmtCompact(d.interest)}</span></span>
      </div>
    </div>`;
  }).join('');
}

/* ── Range ↔ Input Sync ── */
function syncRange(inputId, rangeId, labelId, formatter) {
  const inp = document.getElementById(inputId);
  const rng = document.getElementById(rangeId);
  const lbl = document.getElementById(labelId);

  inp.addEventListener('input', () => {
    rng.value = inp.value;
    lbl.textContent = formatter(inp.value);
    update();
  });
  rng.addEventListener('input', () => {
    inp.value = rng.value;
    lbl.textContent = formatter(rng.value);
    update();
  });
}

/* ── Init ── */
syncRange('initial', 'r-initial', 'lbl-initial', v => fmtCompact(parseInt(v)));
syncRange('monthly', 'r-monthly', 'lbl-monthly', v => fmtCompact(parseInt(v)));
syncRange('rate',    'r-rate',    'lbl-rate',    v => parseFloat(v).toFixed(1) + '%');
syncRange('years',   'r-years',   'lbl-years',   v => v + '년');

document.getElementById('compound').addEventListener('change', update);

update();