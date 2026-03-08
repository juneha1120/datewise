import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService, AuthUser } from './service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() body: { email: string; password: string; displayName: string }) {
    return this.authService.signup(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @Post('google')
  loginGoogle(@Body() body: { idToken: string }) {
    return this.authService.googleLogin(body);
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string): Promise<AuthUser> {
    const token = authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();
    return this.authService.getMe(token);
  }
}
