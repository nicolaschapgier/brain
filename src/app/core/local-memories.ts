import { Injectable } from '@angular/core';
import { Memory, parseMemories } from './memory.model';

const DB_NAME = 'brain';
const STORE = 'memories';

interface Stored extends Memory {
  savedAt: number;
}

/**
 * Les souvenirs ajoutés depuis l'appli, gardés sur l'appareil (IndexedDB : le `localStorage` est trop petit pour des
 * photos). C'est la version « test » du formulaire : plus tard, ce service sera remplacé par un envoi à un serveur.
 */
@Injectable({ providedIn: 'root' })
export class LocalMemories {
  private database: Promise<IDBDatabase> | null = null;

  /** Les souvenirs ajoutés, dans l'ordre d'ajout. Liste vide si le stockage est indisponible (navigation privée…). */
  async list(): Promise<Memory[]> {
    try {
      const rows = await this.request<Stored[]>('readonly', (store) => store.getAll());
      return parseMemories(rows.sort((a, b) => a.savedAt - b.savedAt));
    } catch (error) {
      console.warn('[memories] souvenirs ajoutés indisponibles', error);
      return [];
    }
  }

  /** Enregistre un souvenir. Échoue si le stockage est indisponible ou plein : à l'appelant de le dire. */
  async add(memory: Memory): Promise<void> {
    const row: Stored = { ...memory, savedAt: Date.now() };
    await this.request('readwrite', (store) => store.put(row));
  }

  async clear(): Promise<void> {
    await this.request('readwrite', (store) => store.clear());
  }

  private open(): Promise<IDBDatabase> {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB indisponible'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  }

  /** Une requête dans sa propre transaction ; la promesse se résout quand la transaction est validée. */
  private async request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}
