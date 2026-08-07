import * as mysql from 'mysql2/promise';
import { config } from '../config/configuration';
import { Logger } from '@nestjs/common';

/**
 * MySQL 连接池
 * 全局单例，各 service 注入使用
 */
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: mysql.Pool | null = null;

  /**
   * 获取连接池（懒加载）
   */
  getPool(): mysql.Pool {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4',
      });
      this.logger.log('MySQL 连接池已创建');
    }
    return this.pool;
  }

  /**
   * 执行查询
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    try {
      const [rows] = await this.getPool().execute(sql, params);
      return rows;
    } catch (err) {
      this.logger.error(`SQL 执行失败: ${sql} | 错误: ${err.message}`);
      throw err;
    }
  }

  /**
   * 检查数据库是否可用
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.getPool().execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

// 单例
export const databaseService = new DatabaseService();
