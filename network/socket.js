const dgram = require('dgram');

module.exports = function Socket({
  port, host, batch = true, maxBufferSize = 1000,
}) {
  if (!port) {
    throw new TypeError('port is mandatory');
  }
  if (!host) {
    throw new TypeError('host is mandatory');
  }

  const socket = dgram.createSocket('udp4');
  socket.unref();

  let buffer = [];
  let bufferSize = 0;

  this.send = ({ message, callback }) => {
    if (!message) {
      throw new TypeError('message is mandatory');
    }
    if (callback && typeof callback !== 'function') {
      throw new TypeError('callback should be a function');
    }

    if (batch === true) {
      append({ message, callback });
    } else {
      sendImmediate({ message, callback });
    }
  };

  function append({ message, callback }) {
    buffer.push({ message, callback });
    bufferSize += message.length;

    if (bufferSize > maxBufferSize) {
      const bufferedMessage = buffer.map(x => x.message).join('\n');
      const callbacks = buffer.map(x => x.callback);
      // We capture the messages to send first to avoid concurrency issues for handling the buffer.
      // If we purge it after, new messages added to the buffer won't be sent, or worse, resent.
      bufferSize = 0;
      buffer = [];

      sendImmediate({
        message: bufferedMessage,
        callback: err => {
          callbacks.filter(cb => cb).forEach(cb => cb(err));
        },
      });
    }
  }

  function sendImmediate({ message, callback }) {
    const bytes = Buffer.from(message);
    socket.send(bytes, 0, bytes.length, port, host, err => {
      if (!callback) {
        return;
      }

      if (err) {
        callback(err);
        return;
      }

      callback();
    });
  }
};