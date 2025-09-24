const socket = io();
const reportTable = document.getElementById('reportTable');
const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');

const todayStr = new Date().toISOString().slice(0, 10);
fromDateInput.value = todayStr;
toDateInput.value = todayStr;
fromDateInput.max = todayStr;
toDateInput.max = todayStr;

let callEvents = [];
let pieChart = null;
let barChart = null;
let holidays = [];

function addHoliday() {
  const input = document.getElementById('holidayInput');
  if (!input.value) return;
  if (!holidays.includes(input.value)) {
    holidays.push(input.value);
    renderHolidayList();
  }
  input.value = '';
}

function renderHolidayList() {
  const ul = document.getElementById('holidayList');
  ul.innerHTML = '';
  holidays.forEach((d, idx) => {
    const li = document.createElement('li');
    li.textContent = d;
    const btn = document.createElement('button');
    btn.textContent = '❌';
    btn.style.marginLeft = '10px';
    btn.onclick = () => {
      holidays.splice(idx, 1);
      renderHolidayList();
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function getStatusClass(stt) {
  stt = (stt || '').toLowerCase().trim();
  if (/nhấc máy|trả lời|answered|completed|connect|connected|answered call/.test(stt))
    return 'answered';
  if (/không nhấc máy|không bắt máy|hủy|huỷ|no answer|cancel|cancelled|declined|busy|rejected|failed/.test(stt))
    return 'notAnswered';
  if (/nhỡ|missed|missed call/.test(stt))
    return 'missed';
  return '';
}

function markCalledBack(events) {
  const missedInboundCIDs = new Set();
  for (const e of events) {
    const st = getStatusClass(e.status);
    if (e.dir?.toLowerCase() === 'inbound' && (st === 'missed' || st === 'notAnswered')) {
      missedInboundCIDs.add(e.cid);
    }
  }
  events.forEach(e => {
    if (missedInboundCIDs.has(e.cid)) {
      if (e.dir?.toLowerCase() === 'outbound') {
        e.calledBackAgent = true;
        e.calledBackCustomer = false;
      } else if (e.dir?.toLowerCase() === 'inbound') {
        e.calledBackAgent = false;
        e.calledBackCustomer = true;
      } else {
        e.calledBackAgent = false;
        e.calledBackCustomer = false;
      }
    } else {
      e.calledBackAgent = false;
      e.calledBackCustomer = false;
    }
  });
}

function aggregateData(events) {
  let answered = 0, notAnswered = 0, noPickUp = 0;
  let calledBackAgent = 0, calledBackCustomer = 0;
  let inbound = 0, outbound = 0, inboundAnswered = 0, outboundAnswered = 0;
  let total = 0;

  events.forEach(e => {
    const st = getStatusClass(e.status);
    const dir = e.dir?.toLowerCase();

    if (dir === 'internal') return;
    if (!st) return;

    total++;

    if (dir === 'inbound') {
      inbound++;
      if (st === 'answered') {
        answered++;
        inboundAnswered++;
      } else if (st === 'missed') {
        noPickUp++;
      }
    } else if (dir === 'outbound') {
      outbound++;
      if (st === 'answered') {
        answered++;
        outboundAnswered++;
      } else if (st === 'notAnswered') {
        notAnswered++;
      }
    }

    if (e.calledBackAgent) calledBackAgent++;
    if (e.calledBackCustomer) calledBackCustomer++;
  });

  const ratio = total ? ((answered / total) * 100).toFixed(1) : 0;
  const inboundRatio = inbound ? ((inboundAnswered / inbound) * 100).toFixed(1) : 0;
  const outboundRatio = outbound ? ((outboundAnswered / outbound) * 100).toFixed(1) : 0;

  return { 
    answered, notAnswered, noPickUp,
    calledBackAgent, calledBackCustomer,
    inbound, outbound, inboundAnswered, outboundAnswered,
    total, ratio, inboundRatio, outboundRatio
  };
}

function filterByDate(events, from, to) {
  const fromTime = from ? new Date(from + 'T00:00:00').getTime() : null;
  const toTime = to ? new Date(to + 'T23:59:59').getTime() : null;
  const skipWeekend = document.getElementById('skipWeekend').checked;

  return events.filter(e => {
    if (!e.time) return false;
    const d = new Date(e.time);
    const t = d.getTime();

    if (skipWeekend && (d.getDay() === 0 || d.getDay() === 6)) return false;

    const dStr = d.toISOString().slice(0, 10);
    if (holidays.includes(dStr)) return false;

    if (fromTime !== null && t < fromTime) return false;
    if (toTime !== null && t > toTime) return false;
    return true;
  });
}

function renderTable(data, from, to) {
  const fromD = new Date(from);
  const toD = new Date(to);
  const dateRangeStr = from === to 
    ? fromD.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' })
    : fromD.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' }) + ' - ' + toD.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });

  const tbl = `
    <tr><th>Chỉ số</th><th>Giá trị (${dateRangeStr})</th></tr>
    <tr><td>Tổng số đã trả lời</td><td>${data.answered}</td></tr>
    <tr><td>Gọi đến</td><td>${data.inbound}</td></tr>
    <tr><td>Gọi đến (đã trả lời)</td><td>${data.inboundAnswered}</td></tr>
    <tr><td>Gọi đến không bắt máy</td><td>${data.noPickUp}</td></tr>
    <tr><td>Tỷ lệ trả lời (gọi đến)</td><td>${data.inboundRatio}%</td></tr>
    <tr><td>Gọi đi</td><td>${data.outbound}</td></tr>
    <tr><td>Gọi đi (đã trả lời)</td><td>${data.outboundAnswered}</td></tr>
    <tr><td>Gọi đi không bắt máy</td><td>${data.notAnswered}</td></tr>
    <tr><td>Tỷ lệ trả lời (gọi đi)</td><td>${data.outboundRatio}%</td></tr>
    <tr><td>Tổng cuộc gọi</td><td>${data.total}</td></tr>
    <tr><td>Tỷ lệ trả lời (tất cả)</td><td>${data.ratio}%</td></tr>
  `;
  reportTable.innerHTML = tbl;
}

function renderExtTable(events) {
  const extCount = {};
  Object.keys(window.extNames).forEach(ext => extCount[ext] = 0);

  events.forEach(e => {
    const st = getStatusClass(e.status);
    if (!st) return;
    if (st === 'notAnswered') return;

    let ext = null;
    if (e.ext) ext = e.ext;
    else if (e.Ch) {
      const m = e.Ch.match(/\/(\d+)-/);
      if (m) ext = m[1];
    }
    if (ext && extCount.hasOwnProperty(ext)) {
      extCount[ext]++;
    }
  });

  const sortedExts = Object.entries(extCount).sort((a, b) => b[1] - a[1]);
  const tbody = document.getElementById('extTableBody');
  tbody.innerHTML = '';
  sortedExts.forEach(([ext, count]) => {
    let star = '';
    if (count >= 100000) star = '💎💎💎';
    else if (count >= 50000) star = '💎💎';
    else if (count >= 20000) star = '💎';
    else if (count >= 10000) star = '🌟';
    else if (count >= 5000) star = '⭐';
    else if (count >= 2000) star = '✨';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${ext} - ${window.extNames[ext]} ${star}</td><td>${count}</td>`;
    tbody.appendChild(tr);
  });
}

function renderCharts(data) {
  const pieData = [data.answered, data.notAnswered, data.noPickUp];
  const pieLabels = ['Trả lời', 'Gọi đi không bắt máy', 'Gọi đến không bắt máy'];
  const pieColors = ['#28a745', '#dc3545', '#ffc107'];

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'pie',
    data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderColor: '#fff', borderWidth: 2 }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Tỷ lệ trả lời' } } }
  });

  const barLabels = ['Gọi đến', 'Gọi đi'];
  const barData = {
    labels: barLabels,
    datasets: [
      { label: 'Trả lời', data: [data.inboundAnswered, data.outboundAnswered], backgroundColor: '#28a745' },
      { label: 'Không bắt máy', data: [data.noPickUp, data.notAnswered], backgroundColor: '#dc3545' },
      { label: 'Tổng', data: [data.inbound, data.outbound], backgroundColor: '#007bff' }
    ]
  };

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: barData,
    options: { 
      responsive: true,
      plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'So sánh Inbound vs Outbound' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function loadReport() {
  const from = fromDateInput.value;
  const to = toDateInput.value;
  if (!from || !to) { alert('Vui lòng chọn từ ngày và đến ngày'); return; }
  if (from > to) { alert('Ngày "Từ ngày" không được lớn hơn "Đến ngày"'); return; }
  const filteredEvents = filterByDate(callEvents, from, to);
  markCalledBack(filteredEvents);
  const aggregated = aggregateData(filteredEvents);
  renderTable(aggregated, from, to);
  renderCharts(aggregated);

  const extEvents = callEvents.filter(e => {
    const t = new Date(e.time).getTime();
    const fromTime = new Date(from + 'T00:00:00').getTime();
    const toTime = new Date(to + 'T23:59:59').getTime();
    return t >= fromTime && t <= toTime;
  });
  renderExtTable(extEvents);
}

fetch('/logs')
  .then(res => res.json())
  .then(data => {
    callEvents = data.map(ev => ({ ...ev, statusClass: ev.statusClass || getStatusClass(ev.status) }));
    loadReport();
  })
  .catch(e => console.error('Lỗi tải logs:', e));

socket.on('call-event', data => {
  data.statusClass = data.statusClass || getStatusClass(data.status);
  callEvents.push(data);
  const from = fromDateInput.value;
  const to = toDateInput.value;
  if (data.time >= from && data.time <= to + 'T23:59:59') loadReport();
});