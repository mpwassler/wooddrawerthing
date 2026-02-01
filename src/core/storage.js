/**
 * @fileoverview Storage Utility (IndexedDB)
 * Handles persistence of projects and shapes.
 */

const DB_NAME = 'WoodCutPlannerDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

export const Storage = {
    db: null,

    init: () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                Storage.db = event.target.result;
                resolve(Storage.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    },

    saveProject: (project) => {
        return new Promise((resolve, reject) => {
            const transaction = Storage.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(project);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },

    getAllProjects: () => {
        return new Promise((resolve, reject) => {
            const transaction = Storage.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },

    deleteProject: (id) => {
        return new Promise((resolve, reject) => {
            const transaction = Storage.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }
};
