const mongoose = require('mongoose');

const callEventSchema = new mongoose.Schema({
  cid: { type: String, required: true },
  ext: { type: String, required: true },
  did: String,
  dir: String,
  time: { type: Date, required: true },
  status: String,
  duration: Number,
  ivr: String,
  queue: String,
  billBy: String,
  handled: { type: Boolean, default: false },
  note: { type: String, default: '' }
});

const CallEvent = mongoose.model('CallEvent', callEventSchema);

module.exports = CallEvent;