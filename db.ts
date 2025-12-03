
import { SavedProject, ProjectState } from './types';

const DB_NAME = 'SiteMapperDB';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
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
    
    const id = project.id || crypto.randomUUID();
    const projectToSave: SavedProject = {
      ...project,
      id,
      lastModified: Date.now(),
    };

    const request = store.put(projectToSave);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
};

export const getProjects = async (): Promise<SavedProject[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        // Sort by last modified desc
        const res = request.result as SavedProject[];
        res.sort((a, b) => b.lastModified - a.lastModified);
        resolve(res);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
