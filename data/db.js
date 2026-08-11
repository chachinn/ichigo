/* ==========================================================
   ICHIGO FILE STORE — BUILD 2
   LOCATION: /data/db.js
   IndexedDB storage for receipt photos, booking attachments,
   trip covers and travel-journal photos.
   ========================================================== */

window.IchigoDB = (() => {
  const DB_NAME = "ichigo-local-files";
  const DB_VERSION = 1;
  const STORE_NAME = "files";
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function put(blob, meta = {}) {
    if (!blob) return "";
    const db = await open();
    const id = crypto.randomUUID();
    const record = {
      id,
      blob,
      name: meta.name || "file",
      kind: meta.kind || "attachment",
      mime: blob.type || meta.mime || "application/octet-stream",
      createdAt: Date.now()
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    return id;
  }

  async function get(id) {
    if (!id) return null;
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function remove(id) {
    if (!id) return;
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clear() {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function objectURL(id) {
    const record = await get(id);
    return record ? URL.createObjectURL(record.blob) : "";
  }

  async function compressImage(file, maxSide = 1400, quality = 0.78) {
    if (!file || !file.type?.startsWith("image/")) return file;

    const url = URL.createObjectURL(file);
    const image = new Image();

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });

      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, width, height);

      return await new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob || file), "image/jpeg", quality);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return { open, put, get, remove, clear, objectURL, compressImage };
})();