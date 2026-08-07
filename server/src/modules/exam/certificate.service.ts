import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { databaseService } from '../../database/database.service';

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const CERTIFICATES_FILE = path.join(DATA_DIR, 'certificates.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CERTIFICATES_FILE)) fs.writeFileSync(CERTIFICATES_FILE, '[]');
}

function readJson(): any[] {
  ensureDataFiles();
  try { return JSON.parse(fs.readFileSync(CERTIFICATES_FILE, 'utf-8')) || []; } catch { return []; }
}

function writeJson(data: any[]): void {
  ensureDataFiles();
  fs.writeFileSync(CERTIFICATES_FILE, JSON.stringify(data, null, 2));
}

function genId(): string {
  return 'CERT' + Date.now() + Math.floor(Math.random() * 1000);
}

export interface Certificate {
  id: string;
  phone: string;
  name: string;
  examId: string;
  examTitle: string;
  score: number;
  totalScore: number;
  percentage: number;
  issuedAt: string;
}

export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);
  private useDb = false;

  constructor() {
    this.initDb();
  }

  private async initDb() {
    try {
      const healthy = await databaseService.isHealthy();
      this.useDb = healthy;
      if (healthy) this.logger.log('证书模块使用 MySQL 存储');
      else this.logger.warn('MySQL 不可用，降级为 JSON 文件存储');
    } catch (e) {
      this.logger.warn('MySQL 初始化失败，降级JSON: ' + e.message);
    }
  }

  async findByPhone(phone: string): Promise<Certificate[]> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query(
          'SELECT * FROM certificates WHERE phone = ? ORDER BY issued_at DESC', [phone]
        );
        return rows.map(this.mapRow);
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    return readJson()
      .filter((c) => c.phone === phone)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }

  async findByPhoneAndExam(phone: string, examId: string): Promise<Certificate | null> {
    if (this.useDb) {
      try {
        const rows = await databaseService.query(
          'SELECT * FROM certificates WHERE phone = ? AND exam_id = ?', [phone, examId]
        );
        return rows.length > 0 ? this.mapRow(rows[0]) : null;
      } catch (e) {
        this.logger.warn('MySQL查询失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const certs = readJson();
    return certs.find((c) => c.phone === phone && c.examId === examId) || null;
  }

  async create(data: Partial<Certificate>): Promise<Certificate> {
    const id = genId();
    const cert: Certificate = {
      id,
      phone: data.phone || '',
      name: data.name || data.phone || '',
      examId: data.examId || '',
      examTitle: data.examTitle || '',
      score: data.score || 0,
      totalScore: data.totalScore || 0,
      percentage: data.percentage || 0,
      issuedAt: new Date().toISOString(),
    };

    if (this.useDb) {
      try {
        await databaseService.query(
          'INSERT INTO certificates (id, phone, name, exam_id, exam_title, score, total_score, percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, cert.phone, cert.name, cert.examId, cert.examTitle,
           cert.score, cert.totalScore, cert.percentage]
        );
      } catch (e) {
        this.logger.warn('MySQL插入失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    if (!this.useDb) {
      const certs = readJson();
      certs.push(cert);
      writeJson(certs);
    }
    return cert;
  }

  async delete(id: string): Promise<boolean> {
    if (this.useDb) {
      try {
        const result = await databaseService.query('DELETE FROM certificates WHERE id = ?', [id]);
        return (result as any).affectedRows > 0;
      } catch (e) {
        this.logger.warn('MySQL删除失败，降级JSON: ' + e.message);
        this.useDb = false;
      }
    }
    const certs = readJson();
    const filtered = certs.filter((c) => c.id !== id);
    writeJson(filtered);
    return filtered.length < certs.length;
  }

  private mapRow(row: any): Certificate {
    return {
      id: row.id, phone: row.phone, name: row.name || '',
      examId: row.exam_id || '', examTitle: row.exam_title || '',
      score: row.score, totalScore: row.total_score,
      percentage: row.percentage, issuedAt: row.issued_at,
    };
  }
}
