
const socket = io();
const table = document.getElementById('call-events');
const filterSelect = document.getElementById('filter');
const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const fromTime = document.getElementById('fromTime');
const toTime = document.getElementById('toTime');
const searchTypeSelect = document.getElementById('searchType');
const searchInput = document.getElementById('searchInput');
const resetBtn = document.getElementById('resetBtn');

let callEvents = [];

const getStatusClass = stt => {
  stt = (stt || '').toLowerCase().trim();
  if (/nhấc máy|trả lời|answered|completed|connect|connected|answered call/.test(stt)) return 'answered';
  if (/không nhấc máy|không bắt máy|hủy|huỷ|no answer|cancel|cancelled|declined|busy|rejected|failed/.test(stt)) return 'not-answered';
  if (/nhỡ|missed|missed call/.test(stt)) return 'missed';
  return '';
};

const formatTime = isoTime => new Date(isoTime).toLocaleString('vi-VN');
const formatDuration = sec => {
  if (!sec && sec !== 0) return '';
  sec = Math.floor(sec);
  if (sec < 60) return `${sec} giây`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} phút${s > 0 ? ` ${s} giây` : ''}`;
};

function removeQueueDuplicates(events) {
  const result = [];
  const grouped = {};

  for (const e of events) {
    const key = `${e.cid}_${new Date(e.time).toISOString().slice(0,19)}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  for (const key in grouped) {
    const group = grouped[key];
    const hasExt = group.some(ev => ev.ext && ev.ext !== "4000");
    if (hasExt) {
      result.push(...group.filter(ev => ev.ext && ev.ext !== "4000"));
    } else {
      result.push(...group);
    }
  }
  return result;
}

const renderNoteCell = data => {
  const statusClass = data.statusClass || getStatusClass(data.status);
  if (['missed', 'not-answered'].includes(statusClass)) {
    if (data.handled) return `✅ ${data.note || 'Đã xử lý'}`;
    const reasons = ["Không liên lạc được", "Khách từ chối", "Lý do khác"];
    let options = `<option value="">-- Chọn lý do --</option>`;
    reasons.forEach(r => { options += `<option value="${r}" ${data.note === r ? "selected" : ""}>${r}</option>`; });
    return `
      <select style="width:220px" onchange="toggleOtherInput(this)">
        ${options}
      </select>
      <input type="text" placeholder="Nhập lý do khác..." style="width:200px; display:none; margin-left:5px"/>
      <button onclick="saveNote('${data.cid}', '${data.ext}', '${data.time}', this)">💾 Lưu</button>
    `;
  }
  return '';
};

window.toggleOtherInput = function(selectEl) {
  const input = selectEl.nextElementSibling;
  if (selectEl.value === "Lý do khác") {
    input.style.display = "inline-block";
  } else {
    input.style.display = "none";
    input.value = "";
  }
};

window.saveNote = (cid, ext, time, btn) => {
  const select = btn.previousElementSibling.previousElementSibling;
  const input = btn.previousElementSibling;
  let noteValue = select.value;

  if (!noteValue) return alert('Vui lòng chọn lý do!');
  if (noteValue === "Lý do khác") {
    if (!input.value.trim()) return alert('Vui lòng nhập lý do khác!');
    noteValue = input.value.trim();
  }

  fetch('/mark-handled', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid, ext, time, note: noteValue })
  })
  .then(res => res.json())
  .then(resp => {
    if (resp.success) {
      btn.parentElement.innerHTML = `✅ ${noteValue}`;
      const event = callEvents.find(e => e.cid === cid && e.ext === ext && e.time === time);
      if (event) { event.handled = true; event.note = noteValue; }
    }
  });
};

function getExtLabel(data) {
  const extRaw = data.Ext || data.ext || "";
  const ext = extRaw.toUpperCase();
  const queue = data.Queue || data.queue || "";
  const billBy = data.BillSecBy || "";
  const event = (data.Event || "").toLowerCase();
  const isRinging = ["register", "show"].includes(event);

  if (!extRaw || /^IVR/i.test(ext)) 
    return isRinging ? `${extRaw ? `📢 Lời chào (${extRaw})` : "❓ Không rõ"} - 📳 Đang reo` 
                    : extRaw ? `📢 Lời chào (${extRaw})` : "❓ Không rõ";

  if (window.extNames[ext]) return `${ext} - ${window.extNames[ext]}${isRinging ? " - 📳 Đang reo" : ""}`;
  if (ext !== "N/A") return isRinging ? `${ext} - 📳 Đang reo` : ext;
  if (queue) return `🛑 Hàng chờ (${queue})${isRinging ? " - 📳 Đang reo" : ""}`;
  if (/^queue$/i.test(billBy)) return `🛑 Hàng chờ (N/A)${isRinging ? " - 📳 Đang reo" : ""}`;
  if (event === "missed" || event === "not answered") return "⏰ Ngoài giờ";
  return "⏰ Ngoài giờ";
}

const createRow = data => {
  const statusClass = data.statusClass || getStatusClass(data.status);
  if (!statusClass) return null;
  const extDisplay = getExtLabel(data);

  let dirLabel = 'Không rõ', dirClass = '';
  if (window.extNames[data.cid]) { dirLabel = '🏢 Nội bộ'; dirClass = 'dir-internal'; }
  else if (data.dir?.toLowerCase() === 'inbound') { dirLabel = '📥 Gọi đến'; dirClass = 'dir-inbound'; }
  else if (data.dir?.toLowerCase() === 'outbound') { dirLabel = '📤 Gọi đi'; dirClass = 'dir-outbound'; }

  const row = document.createElement('tr');
  row.dataset.statusClass = statusClass;
  row.dataset.time = data.time;
  row.innerHTML = `
    <td>${data.cid || 'Không rõ'}</td>
    <td>${extDisplay}</td>
    <td class="${dirClass}">${dirLabel}</td>
    <td>${formatTime(data.time)}${statusClass === 'answered' && data.duration ? ` (${formatDuration(data.duration)})` : ''}</td>
    <td class="status ${statusClass}">${data.status}</td>
    <td>${renderNoteCell(data)}</td>
  `;
  return row;
};

const renderTable = () => {
  const selected = filterSelect.value;
  const from = fromDate.value ? new Date(fromDate.value) : null;
  const to = toDate.value ? new Date(toDate.value + 'T23:59:59') : null;
  const [fromH, fromM] = fromTime.value.split(':').map(Number);
  const [toH, toM] = toTime.value.split(':').map(Number);

  table.innerHTML = '';

  const filteredItems = removeQueueDuplicates(callEvents);
  const sortedItems = [...filteredItems].sort((a, b) => new Date(b.time) - new Date(a.time));

  let count = 0;
  sortedItems.forEach(item => {
    const itemDate = new Date(item.time);
    let matchStatus = true;

    if (selected !== 'all') {
      if (['answered', 'not-answered', 'missed'].includes(selected)) {
        matchStatus = item.statusClass === selected;
      } else if (selected === 'inbound' || selected === 'outbound' || selected === 'internal') {
        if (selected === 'internal') { matchStatus = window.extNames[item.cid] && item.ext; }
        else { matchStatus = item.dir && item.dir.toLowerCase() === selected; }
      }
    }

    const matchDate = (!from || itemDate >= from) && (!to || itemDate <= to);
    const matchTime = 
      (itemDate.getHours() > fromH || (itemDate.getHours() === fromH && itemDate.getMinutes() >= fromM)) &&
      (itemDate.getHours() < toH || (itemDate.getHours() === toH && itemDate.getMinutes() <= toM));

    const searchType = searchTypeSelect.value;
    const keyword = searchInput.value.trim().toLowerCase();
    let matchSearch = true;
    if (keyword) {
      if (searchType === "cid") { matchSearch = item.cid && item.cid.toLowerCase().includes(keyword); }
      else if (searchType === "ext") { matchSearch = item.ext && item.ext.toLowerCase().includes(keyword); }
    }

    if (matchStatus && matchDate && matchTime && matchSearch) {
      const row = createRow(item);
      if (row) { table.appendChild(row); count++; }
    }
  });
};

const getTodayDateString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

resetBtn.addEventListener('click', () => {
  filterSelect.value = 'all';
  fromDate.value = toDate.value = getTodayDateString();
  fromTime.value = "00:00";
  toTime.value = "23:59";
  searchTypeSelect.value = "cid";
  searchInput.value = "";
  renderTable();
});

[filterSelect, fromDate, toDate, fromTime, toTime].forEach(el => el.addEventListener('change', renderTable));
searchTypeSelect.addEventListener('change', renderTable);
searchInput.addEventListener('input', renderTable);

fromDate.value = toDate.value = getTodayDateString();

fetch('/logs')
  .then(res => res.json())
  .then(data => {
    callEvents = data.map(ev => ({ ...ev, statusClass: ev.statusClass || getStatusClass(ev.status) }));
    renderTable();
  });

socket.on('call-event', data => {
  data.statusClass = data.statusClass || getStatusClass(data.status);
  callEvents.push(data);
  renderTable();
});

document.getElementById('viewReportBtn').addEventListener('click', () => {
  window.open('/baocaoall', '_blank');
});

// Chặn chuột phải và phím tắt
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (e.ctrlKey && (e.key === "u" || e.key === "U" || e.key === "s" || e.key === "S")) e.preventDefault();
  if (e.key === "F12") e.preventDefault();
});