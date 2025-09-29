const socket = io();
const reportTable = document.getElementById('reportTable');
const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');

const todayStr = new Date().toISOString().slice(0,10);
fromDateInput.value = todayStr;
toDateInput.value = todayStr;
fromDateInput.max = todayStr;
toDateInput.max = todayStr;

let callEvents = [];
let pieChart = null;
let barChart = null;

const extNames = window.extNames;

function getStatusClass(stt) {
  stt = (stt || '').toLowerCase().trim();
  if (/nhấc máy|trả lời|answered|completed|connect|connected|answered call/.test(stt))
    return 'answered';
  if (/không nhấc máy|không bắt máy|hủy|huỷ|no answer|cancel|cancelled|declined|busy|rejected|failed/.test(stt))
    return 'notAnswered';
  if (/nhỡ|missed|missed call/.test(stt))
    return 'missed';
  return 'unknown';
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
  const priority = { answered: 3, notAnswered: 2, missed: 1, unknown: 0 };
  const latestByCID = {};

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    const cid = e.cid || '';
    const st = getStatusClass(e.status);
    if (!latestByCID[cid] || priority[st] > priority[getStatusClass(latestByCID[cid].status)]) {
      latestByCID[cid] = e;
    }
  }

  let answered = 0, notAnswered = 0, noPickUp = 0;
  let calledBackAgent = 0, calledBackCustomer = 0;
  let total = 0;

  Object.values(latestByCID).forEach(e => {
    const st = getStatusClass(e.status);
    total++;
    if (st === 'answered') answered++;
    else if (st === 'notAnswered') notAnswered++;
    else if (st === 'missed') noPickUp++;
    if (e.calledBackAgent) calledBackAgent++;
    if (e.calledBackCustomer) calledBackCustomer++;
  });

  const ratio = total ? ((answered / total) * 100).toFixed(1) : 0;

  return { answered, notAnswered, noPickUp, calledBackAgent, calledBackCustomer, total, ratio };
}

function filterByDate(events, from, to) {
  const fromTime = from ? new Date(from + 'T00:00:00').getTime() : null;
  const toTime = to ? new Date(to + 'T23:59:59').getTime() : null;
  return events.filter(e => {
    if (!e.time) return false;
    const t = new Date(e.time).getTime();
    if (fromTime !== null && t < fromTime) return false;
    if (toTime !== null && t > toTime) return false;
    return true;
  });
}

function renderTable(data, from, to) {
  const fromD = new Date(from);
  const toD = new Date(to);
  const dateRangeStr = from === to 
    ? fromD.toLocaleDateString('vi-VN', { day:'2-digit', month:'short', year:'numeric' })
    : fromD.toLocaleDateString('vi-VN', { day:'2-digit', month:'short' }) + ' - ' + toD.toLocaleDateString('vi-VN', { day:'2-digit', month:'short', year:'numeric' });

  const tbl = `
    <tr><th>Chỉ số</th><th>Giá trị (${dateRangeStr})</th></tr>
    <tr><td>Trả lời</td><td>${data.answered}</td></tr>
    <tr><td>Không bắt máy</td><td>${data.notAnswered}</td></tr>
    <tr><td>Số gọi nhỡ hiện tại</td><td>${data.noPickUp}</td></tr>
    <tr><td>Đã liên hệ lại (gọi đi từ máy nhánh)</td><td>${data.calledBackAgent}</td></tr>
    <tr><td>Đã liên hệ lại (khách tự gọi lại)</td><td>${data.calledBackCustomer}</td></tr>
    <tr><td>Tổng cuộc gọi</td><td>${data.total}</td></tr>
    <tr><td>Tỷ lệ trả lời</td><td>${data.ratio}%</td></tr>
  `;
  reportTable.innerHTML = tbl;
}

function renderExtTable(events) {
  const extCount = {};
  Object.keys(extNames).forEach(ext => extCount[ext] = 0);

  const priority = { answered: 3, notAnswered: 2, missed: 1, unknown: 0 };
  const latestByCID = {};

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    const cid = e.cid || '';
    const st = getStatusClass(e.status);
    if (!latestByCID[cid] || priority[st] > priority[getStatusClass(latestByCID[cid].status)]) {
      latestByCID[cid] = e;
    }
  }

  Object.values(latestByCID).forEach(e => {
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
    if (count >= 1000) star = '💎💎💎';
    else if (count >= 500) star = '💎💎';
    else if (count >= 200) star = '💎';
    else if (count >= 100) star = '🌟';
    else if (count >= 50) star = '⭐';
    else if (count >= 20) star = '✨';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ext} - ${extNames[ext]} ${star}</td>
      <td>${count}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCharts(data) {
  const pieData = [data.answered, data.notAnswered];
  const pieLabels = ['Trả lời', 'Không bắt máy'];
  const pieColors = ['#28a745', '#dc3545'];

  if(pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'pie',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: pieColors,
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: 'Tỷ lệ trả lời' }
      }
    }
  });

  const barLabels = ['Trả lời', 'Không bắt máy', 'Số gọi nhỡ hiện tại', 'Đã liên hệ lại (máy nhánh)', 'Đã liên hệ lại (khách)', 'Tổng cuộc gọi'];
  const barData = [
    data.answered,
    data.notAnswered,
    data.noPickUp,
    data.calledBackAgent,
    data.calledBackCustomer,
    data.total
  ];
  const barColors = ['#28a745', '#dc3545', '#ffc107', '#17a2b8', '#fd7e14', '#007bff'];

  if(barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [{
        label: 'Số lượng cuộc gọi',
        data: barData,
        backgroundColor: barColors
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Thống kê chi tiết' }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

function loadReport() {
  const from = fromDateInput.value;
  const to = toDateInput.value;
  if (!from || !to) {
    alert('Vui lòng chọn từ ngày và đến ngày');
    return;
  }
  if (from > to) {
    alert('Ngày "Từ ngày" không được lớn hơn "Đến ngày"');
    return;
  }
  const filteredEvents = filterByDate(callEvents, from, to);
  markCalledBack(filteredEvents);
  const aggregated = aggregateData(filteredEvents);
  renderTable(aggregated, from, to);
  renderCharts(aggregated);
  renderExtTable(filteredEvents);
}

fetch('/logs')
  .then(res => res.json())
  .then(data => {
    callEvents = data.map(ev => ({
      ...ev,
      statusClass: ev.statusClass || getStatusClass(ev.status)
    }));
    loadReport();
  })
  .catch(e => {
    console.error('Lỗi tải logs:', e);
  });

socket.on('call-event', data => {
  data.statusClass = data.statusClass || getStatusClass(data.status);
  callEvents.push(data);
  const from = fromDateInput.value;
  const to = toDateInput.value;
  if (data.time >= from && data.time <= to + 'T23:59:59') {
    loadReport();
  }
});

// Chặn chuột phải và phím tắt
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (e.ctrlKey && (e.key === "u" || e.key === "U" || e.key === "s" || e.key === "S")) {
    e.preventDefault();
  }
  if (e.key === "F12") {
    e.preventDefault();
  }
});