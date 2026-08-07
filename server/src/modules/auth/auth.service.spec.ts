import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { config } from '../../config/configuration';

/**
 * AuthService 核心逻辑测试
 * 重点测试：JWT 签发/验证/刷新、Token 过期处理
 */
describe('AuthService', () => {
  let service: AuthService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: config.jwt.secret,
          signOptions: { expiresIn: config.jwt.expiresIn },
        }),
      ],
      providers: [AuthService],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('JWT Token', () => {
    it('应该能验证自己签发的 Token', async () => {
      const payload = { sub: 'test_openid_123' };
      // 模拟签发
      const jwtService = (service as any).jwtService;
      const token = jwtService.sign(payload);
      expect(token).toBeDefined();

      // 验证
      const verified = jwtService.verify(token);
      expect(verified.sub).toBe('test_openid_123');
    });

    it('无效 Token 应该抛出异常', () => {
      const jwtService = (service as any).jwtService;
      expect(() => jwtService.verify('invalid_token_xyz')).toThrow();
    });

    it('Refresh Token 过期后应该无法使用', async () => {
      const jwtService = (service as any).jwtService;
      // 签发一个已过期的 token（1ms 过期）
      const expiredToken = jwtService.sign(
        { sub: 'test' },
        { expiresIn: '1ms' }
      );
      // 等 10ms 确保过期
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(() => jwtService.verify(expiredToken)).toThrow();
    });
  });

  describe('Refresh Token 逻辑', () => {
    it('有效的 Refresh Token 应该能刷新出新的 Access Token', async () => {
      const jwtService = (service as any).jwtService;
      const payload = { sub: 'refresh_test_openid' };
      const refreshToken = jwtService.sign(payload, {
        expiresIn: '7d',
      });

      // 模拟 refresh 方法
      const result = await service.refresh(refreshToken);
      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');

      // 新 token 应该可以验证
      const verified = jwtService.verify(result.accessToken);
      expect(verified.sub).toBe('refresh_test_openid');
    });

    it('无效的 Refresh Token 应该抛出 UnauthorizedException', async () => {
      await expect(service.refresh('invalid_refresh_token')).rejects.toThrow();
    });
  });

  describe('Token 安全性', () => {
    it('Token 不应该包含敏感信息（只有 sub）', () => {
      const jwtService = (service as any).jwtService;
      const payload = { sub: 'openid_abc' };
      const token = jwtService.sign(payload);

      // 解码 payload 部分（不验证签名）
      const parts = token.split('.');
      const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      expect(decoded.sub).toBe('openid_abc');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      // 不应该有其他敏感字段
      expect(Object.keys(decoded).length).toBe(3); // sub + iat + exp
    });
  });
});
