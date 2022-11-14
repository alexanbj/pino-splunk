/**
 * Implementation by Robert Nagy https://github.com/ronag. Copied from here https://github.com/mcollina/hwp/pull/11
 */
export async function* batchIterator(iterator, opts) {
  const count = opts && opts.count ? opts.count : 16;
  const buffer = [];
  let next;
  let error;
  let done;

  function flush() {
    if (next) {
      next();
      next = null;
    }
  }

  const timeout = opts.timeout ? setTimeout(flush, opts.timeout) : null;

  async function pump() {
    try {
      for await (const item of iterator) {
        buffer.push(item);
        if (buffer.length >= count) {
          await new Promise((resolve) => {
            flush();
            next = resolve;
          });
        }
      }
    } catch (err) {
      error = err;
    } finally {
      done = true;
      if (next) {
        next();
        next = null;
      }
    }
  }

  queueMicrotask(pump);

  try {
    while (true) {
      await new Promise((resolve) => {
        flush();
        next = resolve;
      });

      do {
        yield buffer.splice(0, count);
      } while (buffer.length > count);

      if (error) {
        throw error;
      }

      if (done) {
        if (buffer.length) {
          yield buffer;
        }
        return;
      }

      if (timeout) {
        timeout.refresh();
      }
    }
  } finally {
    done = true;
    if (next) {
      next();
      next = null;
    }
  }
}
