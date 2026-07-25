// IndexedDB storage layer for voice_study
// Replaces SQLite/SQLAlchemy backend; stores lectures, flashcards, summaries, podcasts

let db = null;

async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open("voice_study", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Lectures store: keyPath 'id' autoIncrement
      if (!db.objectStoreNames.contains("lectures")) {
        const lecturesStore = db.createObjectStore("lectures", { keyPath: "id", autoIncrement: true });
        lecturesStore.createIndex("created_at", "created_at", { unique: false });
      }

      // Flashcards store: keyPath 'id' autoIncrement, index on lecture_id
      if (!db.objectStoreNames.contains("flashcards")) {
        const flashcardsStore = db.createObjectStore("flashcards", { keyPath: "id", autoIncrement: true });
        flashcardsStore.createIndex("lecture_id", "lecture_id", { unique: false });
      }

      // Summaries store: keyPath 'lecture_id' (1:1 relationship, no autoIncrement)
      if (!db.objectStoreNames.contains("summaries")) {
        db.createObjectStore("summaries", { keyPath: "lecture_id" });
      }

      // Podcasts store: keyPath 'lecture_id' (1:1 relationship, stores Blob)
      if (!db.objectStoreNames.contains("podcasts")) {
        db.createObjectStore("podcasts", { keyPath: "lecture_id" });
      }
    };
  });
}

async function add(storeName, obj) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.add(obj);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function put(storeName, obj) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(obj);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function get(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getAll(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getAllByIndex(storeName, indexName, value) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function deleteRecord(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function deleteByIndex(storeName, indexName, value) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.openCursor(value);
    let count = 0;
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        count++;
        cursor.continue();
      } else {
        resolve(count);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function runInTransaction(storeNames, mode, fn) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    const stores = {};
    storeNames.forEach(name => {
      stores[name] = transaction.objectStore(name);
    });
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Transaction aborted"));
    transaction.oncomplete = () => resolve();

    fn(stores).catch(err => {
      transaction.abort();
      reject(err);
    });
  });
}
