import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { config } from '../../config/configuration';

export interface WxLoginResult {
  openid: string;
  session_key: string;
  unionid?: string;
}

export interface JwtPayload {
  sub: string;  // openid
  userId?: number;
}

@Injectable()
export class AuthService {
  // 缓存 access_token（getPhoneNumber用的）
  private accessTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private jwtService: JwtService) {}

  // 微信登录：code → openid → JWT
  async wechatLogin(code: string) {
    // Step 1: 用code换取openid和session_key
    const wxResult = await this.code2Session(code);

    // Step 2: 生成JWT Token
    const payload: JwtPayload = { sub: wxResult.openid };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    // Step 3: 返回
    return {
      accessToken,
      refreshToken,
      user: {
        openid: wxResult.openid,
      },
    };
  }

  // 用 getPhoneNumber 的 code 换手机号（新API，不需要 session_key 解密）
  async getPhoneByCode(code: string) {
    // Step 1: 获取微信 access_token
    const wxAccessToken = await this.getWxAccessToken();

    // Step 2: 用 code 换手机号
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${wxAccessToken}`;
    
    try {
      const { data } = await axios.post(url, { code });
      if (data.errcode && data.errcode !== 0) {
        throw new UnauthorizedException(`Wechat phone error: ${data.errmsg}`);
      }
      
      const phoneInfo = data.phone_info;
      return {
        phoneNumber: phoneInfo.phoneNumber,
        purePhoneNumber: phoneInfo.purePhoneNumber,
        countryCode: phoneInfo.countryCode,
        watermark: phoneInfo.watermark,
      };
    } catch (err) {
      console.error('getPhoneByCode error:', err.message);
      throw new UnauthorizedException(`Failed to get phone number: ${err.message}`);
    }
  }

  // 获取微信 access_token（全局接口）
  private async getWxAccessToken(): Promise<string> {
    // 检查缓存
    if (this.accessTokenCache && Date.now() < this.accessTokenCache.expiresAt - 300000) {
      return this.accessTokenCache.token;
    }

    if (!config.wx.appid || !config.wx.secret) {
      throw new UnauthorizedException('Wechat AppID/Secret not configured. Please set WX_APPID and WX_SECRET in .env');
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wx.appid}&secret=${config.wx.secret}`;
    
    try {
      const { data } = await axios.get(url);
      if (data.errcode) {
        throw new UnauthorizedException(`Wechat token error: ${data.errmsg}`);
      }
      
      // 缓存，提前5分钟过期
      this.accessTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000,
      };
      
      return data.access_token;
    } catch (err) {
      throw new UnauthorizedException(`Failed to get access_token: ${err.message}`);
    }
  }

  // 刷新Token
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const newPayload: JwtPayload = { sub: payload.sub };
      const accessToken = this.jwtService.sign(newPayload);
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // 微信 code2session 接口
  private async code2Session(code: string): Promise<WxLoginResult> {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wx.appid}&secret=${config.wx.secret}&js_code=${code}&grant_type=authorization_code`;

    try {
      const { data } = await axios.get(url);
      if (data.errcode) {
        throw new UnauthorizedException(`Wechat error: ${data.errmsg}`);
      }
      return {
        openid: data.openid,
        session_key: data.session_key,
        unionid: data.unionid,
      };
    } catch (err) {
      throw new UnauthorizedException('Wechat login failed');
    }
  }

  // 验证Token
  async validateToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verify(token);
  }
}
