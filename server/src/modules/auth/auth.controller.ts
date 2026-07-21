import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString, IsNotEmpty } from 'class-validator';

class WxLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

class PhoneCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;   // getPhoneNumber 回调里的 code（动态令牌）
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /api/auth/wechat-login  { code: "wx_login_code" }
  @Post('wechat-login')
  @HttpCode(200)
  async wechatLogin(@Body() dto: WxLoginDto) {
    return this.authService.wechatLogin(dto.code);
  }

  // POST /api/auth/phone  { code }
  // 用 getPhoneNumber 的 code 调微信 phonenumber/getAccessToken 接口直接换手机号
  @Post('phone')
  @HttpCode(200)
  async getPhoneNumber(@Body() dto: PhoneCodeDto) {
    return this.authService.getPhoneByCode(dto.code);
  }

  // POST /api/auth/refresh  { refreshToken: "xxx" }
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}
