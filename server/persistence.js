import { Level } from 'level';
import * as Y from 'yjs';

export class LevelPersistence {
  constructor(dbPath = './data/yjs-docs') {
    this.db = new Level(dbPath, { valueEncoding: 'buffer' });
  }

  async loadDoc(roomId) {
    try {
      const data = await this.db.get(`room:${roomId}`);
      return new Uint8Array(data);
    } catch (err) {
      if (err.code === 'LEVEL_NOT_FOUND') return null;
      throw err;
    }
  }

  async saveDoc(roomId, doc) {
    const state = Y.encodeStateAsUpdate(doc);
    await this.db.put(`room:${roomId}`, Buffer.from(state));
  }

  async close() {
    await this.db.close();
  }
}
