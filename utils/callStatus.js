function getCallStatus(event) {
  if (event.Event === 'answer') return '✅ Đã trả lời';
  if (event.Event === 'hide' && event.Disposition === 'NO ANSWER') return '⚠️ Không bắt máy';
  if (event.Event === 'finish' && event.Dir === 'Outbound' &&
    /NO ANSWER|CANCEL|BUSY|FAILED|REJECTED/i.test(event.Disposition || '')) return '⚠️ Không bắt máy';
  if (event.Event === 'finish' && event.Dir === 'Inbound' && !event.TimeAnswer) return '❌ Cuộc gọi nhỡ';
  return '❔ Không rõ';
}

module.exports = { getCallStatus };