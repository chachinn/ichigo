/* ==========================================================
   ICHIGO FILE STORE — BUILD 3
   LOCATION: /data/db.js
   IndexedDB storage for receipt photos, booking attachments,
   trip covers, inbox captures and travel-journal photos.

   Build 3 adds database metadata, storage diagnostics and full
   backup / restore helpers while preserving existing file IDs.
   ========================================================== */

window.IchigoDB = (() => {
  const DB_NAME = "ichigo-local-files";
  const DB_VERSION = 2;
  const FILES = "files";
  const META = "meta";
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: "id" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function tx(store, mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const objectStore = transaction.objectStore(store);
      let result;
      try { result = work(objectStore, transaction); }
      catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    });
  }

  async function put(blob, meta = {}) {
    if (!blob) return "";
    const id = meta.id || crypto.randomUUID();
    const record = {
      id,
      blob,
      name: meta.name || "file",
      kind: meta.kind || "attachment",
      mime: blob.type || meta.mime || "application/octet-stream",
      createdAt: meta.createdAt || Date.now()
    };
    await tx(FILES, "readwrite", store => store.put(record));
    return id;
  }

  async function get(id) {
    if (!id) return null;
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILES, "readonly");
      const request = transaction.objectStore(FILES).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function list() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(FILES, "readonly");
      const request = transaction.objectStore(FILES).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function remove(id) {
    if (!id) return;
    await tx(FILES, "readwrite", store => store.delete(id));
  }

  async function clear() {
    await tx(FILES, "readwrite", store => store.clear());
  }

  async function objectURL(id) {
    const record = await get(id);
    return record ? URL.createObjectURL(record.blob) : "";
  }

  async function setMeta(key, value) {
    await tx(META, "readwrite", store => store.put({ key, value, updatedAt: Date.now() }));
  }

  async function getMeta(key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(META, "readonly");
      const request = transaction.objectStore(META).get(key);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataURL) {
    const [header, payload] = String(dataURL || "").split(",");
    if (!header || !payload) throw new Error("Invalid backup file data");
    const mime = /data:([^;]+)/.exec(header)?.[1] || "application/octet-stream";
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function exportAll() {
    const records = await list();
    return Promise.all(records.map(async record => ({
      id: record.id,
      name: record.name,
      kind: record.kind,
      mime: record.mime,
      createdAt: record.createdAt,
      data: await blobToDataURL(record.blob)
    })));
  }

  async function importAll(records = [], { clearFirst = true } = {}) {
    if (clearFirst) await clear();
    for (const record of records) {
      if (!record?.id || !record?.data) continue;
      const blob = dataURLToBlob(record.data);
      await put(blob, {
        id: record.id,
        name: record.name,
        kind: record.kind,
        mime: record.mime,
        createdAt: record.createdAt
      });
    }
    await setMeta("lastRestore", Date.now());
  }

  async function stats() {
    const records = await list();
    return {
      count: records.length,
      bytes: records.reduce((sum, record) => sum + Number(record.blob?.size || 0), 0),
      byKind: records.reduce((acc, record) => {
        acc[record.kind || "other"] = (acc[record.kind || "other"] || 0) + 1;
        return acc;
      }, {})
    };
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

  return {
    DB_NAME, DB_VERSION,
    open, put, get, list, remove, clear, objectURL,
    setMeta, getMeta, exportAll, importAll, stats, compressImage
  };
})();
