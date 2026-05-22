const originalFetch = window.fetch;
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

function mergeFiles(fileParts) {
  return new Promise((resolve, reject) => {
    let buffers = [];
    function fetchPart(index) {
      if (index >= fileParts.length) {
        let mergedBlob = new Blob(buffers);
        let mergedFileUrl = URL.createObjectURL(mergedBlob);
        resolve(mergedFileUrl);
        return;
      }
      fetch(fileParts[index]).then(response => {
        if (!response.ok) throw new Error("Missing part: " + fileParts[index]);
        return response.arrayBuffer();
      }).then(data => {
        buffers.push(data);
        fetchPart(index + 1);
      }).catch(reject);
    }
    fetchPart(0);
  });
}

function getParts(file, start, end) {
  let parts = [];
  for (let i = start; i <= end; i++) {
    let num = i.toString().padStart(2, '0');
    parts.push(file + ".part" + num);
  }
  return parts;
}

function isGameUnx(url) {
  if (typeof url !== 'string') return false;
  try {
    return new URL(url, location.href).pathname.endsWith('game.unx');
  } catch {
    return url.endsWith('game.unx') || url === 'game.unx';
  }
}

const gameUnxUrlPromise = mergeFiles(getParts("game.unx", 1, 16));

window.fetch = async function (url, ...args) {
  if (isGameUnx(url)) {
    const blobUrl = await gameUnxUrlPromise;
    return originalFetch(blobUrl, ...args);
  }
  return originalFetch(url, ...args);
};

XMLHttpRequest.prototype.open = function (method, url, ...args) {
  if (isGameUnx(url)) {
    this.__gameUnxMethod = method;
    this.__gameUnxArgs = args;
    this.__gameUnxUrl = url;
    return;
  }
  return originalXHROpen.call(this, method, url, ...args);
};

XMLHttpRequest.prototype.send = function (...args) {
  if (this.__gameUnxUrl) {
    const xhr = this;
    gameUnxUrlPromise.then(blobUrl => {
      originalXHROpen.call(xhr, xhr.__gameUnxMethod, blobUrl, ...xhr.__gameUnxArgs);
      originalXHRSend.call(xhr, ...args);
    });
    return;
  }
  return originalXHRSend.call(this, ...args);
};
