import sqlite3 from 'sqlite3';
import { RepositoryPort } from '../../../core/ports/ports.js';
import { Career, Subject, Title, Acquisition } from '../../../core/domain/models.js';

export class SQLiteRepository extends RepositoryPort {
  constructor(dbPath = './bibliografia_node.db') {
    super();
    this.dbPath = dbPath;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err);
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async createTables() {
    const runQuery = (query) => new Promise((resolve, reject) => {
      this.db.run(query, (err) => err ? reject(err) : resolve());
    });

    await runQuery(`
      CREATE TABLE IF NOT EXISTS careers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        facultad TEXT NOT NULL
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        career_id INTEGER,
        plan TEXT,
        semester TEXT,
        FOREIGN KEY(career_id) REFERENCES careers(id)
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS titles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        normalized_author TEXT,
        normalized_title TEXT,
        original_author TEXT,
        original_title TEXT,
        year TEXT,
        publisher TEXT,
        edition TEXT,
        format TEXT,
        physical_availability TEXT,
        online_availability TEXT,
        place TEXT,
        chapter TEXT,
        language TEXT,
        type_bib TEXT
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS title_subject (
        title_id INTEGER,
        subject_id INTEGER,
        PRIMARY KEY (title_id, subject_id)
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS acquisitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_id INTEGER,
        status TEXT,
        available_printed INTEGER DEFAULT 0,
        available_digital INTEGER DEFAULT 0,
        FOREIGN KEY(title_id) REFERENCES titles(id)
      )
    `);
  }

  async getOrCreateCareer(name, facultad) {
    const get = (q, p) => new Promise((res, rej) => this.db.get(q, p, (err, row) => err ? rej(err) : res(row)));
    const run = (q, p) => new Promise((res, rej) => this.db.run(q, p, function(err) { err ? rej(err) : res(this.lastID); }));

    let row = await get('SELECT * FROM careers WHERE name = ?', [name]);
    if (!row) {
      const id = await run('INSERT INTO careers (name, facultad) VALUES (?, ?)', [name, facultad]);
      return new Career({ id, name, facultad });
    }
    return new Career({ id: row.id, name: row.name, facultad: row.facultad });
  }

  async getOrCreateSubject(name, careerId, plan, semester) {
    const get = (q, p) => new Promise((res, rej) => this.db.get(q, p, (err, row) => err ? rej(err) : res(row)));
    const run = (q, p) => new Promise((res, rej) => this.db.run(q, p, function(err) { err ? rej(err) : res(this.lastID); }));

    let row = await get('SELECT * FROM subjects WHERE name = ? AND career_id = ?', [name, careerId]);
    if (!row) {
      const id = await run('INSERT INTO subjects (name, career_id, plan, semester) VALUES (?, ?, ?, ?)', [name, careerId, plan, semester]);
      return new Subject({ id, name, careerId, plan, semester });
    }
    if (plan || semester) {
      await run('UPDATE subjects SET plan = COALESCE(nullif(?, ""), plan), semester = COALESCE(nullif(?, ""), semester) WHERE id = ?', [plan, semester, row.id]);
    }
    return new Subject({ id: row.id, name: row.name, careerId: row.career_id, plan: row.plan || plan, semester: row.semester || semester });
  }

  async findTitleByNormalized(normalizedAuthor, normalizedTitle) {
    const get = (q, p) => new Promise((res, rej) => this.db.get(q, p, (err, row) => err ? rej(err) : res(row)));
    const row = await get('SELECT * FROM titles WHERE LOWER(normalized_author) = LOWER(?) AND LOWER(normalized_title) = LOWER(?)', [normalizedAuthor.trim(), normalizedTitle.trim()]);
    if (!row) return null;
    return new Title({
      id: row.id,
      normalizedAuthor: row.normalized_author,
      normalizedTitle: row.normalized_title,
      year: row.year,
      publisher: row.publisher
    });
  }

  async saveTitle(t) {
    const run = (q, p) => new Promise((res, rej) => this.db.run(q, p, function(err) { err ? rej(err) : res(this.lastID); }));
    const id = await run(`
      INSERT INTO titles (normalized_author, normalized_title, original_author, original_title, year, publisher, edition, format, physical_availability, online_availability, place, chapter, language, type_bib)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      t.normalizedAuthor, t.normalizedTitle, t.originalAuthor, t.originalTitle, t.year, t.publisher, t.edition, t.format, t.physicalAvailability, t.onlineAvailability, t.place, t.chapter, t.language, t.typeBib
    ]);
    t.id = id;
    return t;
  }

  async linkTitleToSubject(titleId, subjectId) {
    const run = (q, p) => new Promise((res, rej) => this.db.run(q, p, function(err) { err ? rej(err) : res(); }));
    await run('INSERT OR IGNORE INTO title_subject (title_id, subject_id) VALUES (?, ?)', [titleId, subjectId]);
  }

  async saveAcquisition(a) {
    const run = (q, p) => new Promise((res, rej) => this.db.run(q, p, function(err) { err ? rej(err) : res(this.lastID); }));
    const id = await run('INSERT INTO acquisitions (title_id, status, available_printed, available_digital) VALUES (?, ?, ?, ?)', [
      a.titleId, a.status, a.availablePrinted ? 1 : 0, a.availableDigital ? 1 : 0
    ]);
    a.id = id;
    return a;
  }

  async getAllReportRows() {
    const all = (q, p) => new Promise((res, rej) => this.db.all(q, p, (err, rows) => err ? rej(err) : res(rows)));
    const query = `
      SELECT c.facultad, c.name as carrera, s.name as asignatura, s.plan, s.semester,
             t.type_bib, t.normalized_author, t.normalized_title, t.year, t.publisher,
             t.edition, t.physical_availability, t.online_availability, a.status
      FROM titles t
      JOIN title_subject ts ON t.id = ts.title_id
      JOIN subjects s ON ts.subject_id = s.id
      JOIN careers c ON s.career_id = c.id
      LEFT JOIN acquisitions a ON t.id = a.title_id
    `;
    return await all(query, []);
  }
}
