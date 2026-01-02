
import { SavedProject, ProjectState } from './types';

const DB_NAME = 'SiteMapperDB';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

/**
 * Fallback UUID generator for non-secure contexts
 */
const getSafeUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
};

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("Errore apertura IndexedDB:", event);
      reject(new Error("Impossibile aprire il database locale."));
    };
    
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveProject = async (project: Omit<SavedProject, 'id' | 'lastModified'> & { id?: string }): Promise<string> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const id = project.id || getSafeUUID();
    const projectToSave: SavedProject = {
      ...project,
      id,
      lastModified: Date.now(),
    };

    const request = store.put(projectToSave);

    request.onsuccess = () => resolve(id);
    request.onerror = (event) => {
      const error = (event.target as any).error;
      console.error("Errore IndexedDB Put:", error);
      reject(error);
    };

    transaction.onabort = (event) => {
        const error = (event.target as any).error;
        console.error("Transazione abortita:", error);
        reject(error || new Error("Salvataggio fallito: spazio esaurito o errore database."));
    };
  });
};

export const getProjects = async (): Promise<SavedProject[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        const res = request.result as SavedProject[];
        res.sort((a, b) => b.lastModified - a.lastModified);
        resolve(res);
    };
    request.onerror = () => reject(new Error("Errore recupero progetti"));
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Errore eliminazione progetto"));
  });
};
