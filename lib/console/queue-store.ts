// Match console: the offline queue, kept in IndexedDB so it survives the
// browser closing the tab or the phone restarting. Browser only.
//
// One object store, keyed by an auto-incrementing number so items come back
// in the order they were added. Indexes: by fixture (to list one match's
// queue) and by item id (to remove one item).
import { createMemoryStore, type QueueItem, type QueueStore } from "./queue";

const DB_NAME = "sees-console";
const DB_VERSION = 1;
const STORE = "queue";

type StoredItem = QueueItem & { seq?: number };

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
      store.createIndex("fixtureId", "fixtureId");
      store.createIndex("id", "id", { unique: true });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => {
      dbPromise = null;
      reject(open.error);
    };
  });
  return dbPromise;
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const result = await run(tx.objectStore(STORE));
  await done;
  return result;
}

function createIndexedDbStore(): QueueStore {
  return {
    async list(fixtureId) {
      const rows = await withStore("readonly", (store) =>
        request(store.index("fixtureId").getAll(fixtureId) as IDBRequest<StoredItem[]>),
      );
      return rows
        .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
        .map((row) => {
          const item = { ...row };
          delete item.seq;
          return item as QueueItem;
        });
    },
    async add(item) {
      await withStore("readwrite", (store) => request(store.add(item)));
    },
    async remove(id) {
      await withStore("readwrite", async (store) => {
        const key = await request(store.index("id").getKey(id));
        if (key !== undefined) await request(store.delete(key));
      });
    },
  };
}

/**
 * The queue store for this browser. Falls back to memory (lost on reload)
 * when IndexedDB isn't available, for example in some private-browsing modes;
 * `persistent` says which one you got so the console can warn.
 */
export async function getQueueStore(): Promise<{ store: QueueStore; persistent: boolean }> {
  if (typeof indexedDB === "undefined") return { store: createMemoryStore(), persistent: false };
  try {
    await openDb();
    return { store: createIndexedDbStore(), persistent: true };
  } catch {
    return { store: createMemoryStore(), persistent: false };
  }
}
