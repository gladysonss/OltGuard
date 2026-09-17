import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { concat, from, map, Observable } from 'rxjs';
import { TrapReceiverService } from './trap-receiver.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('traps')
export class TrapController {
  constructor(
    private readonly trapReceiver: TrapReceiverService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles('ADMIN')
  @Get('recent')
  recent() {
    return this.trapReceiver.getRecentLog();
  }

  @Roles('ADMIN')
  @Delete('recent')
  @HttpCode(HttpStatus.NO_CONTENT)
  clear() {
    this.trapReceiver.clearLog();
  }

  /**
   * EventSource nao consegue mandar header Authorization, entao esse endpoint
   * e publico na rota e autentica manualmente via query param `token`.
   *
   * O EventSource do navegador reconecta sozinho quando a conexao cai
   * (timeout de proxy, rede instavel etc.) e manda de volta o `id` do
   * ultimo evento recebido no header Last-Event-ID. Usamos isso pra so
   * reenviar o historico a partir dali, em vez do buffer inteiro de novo -
   * sem isso cada reconexao duplicava tudo que ja tinha aparecido na tela.
   */
  @Public()
  @Sse('stream')
  async stream(
    @Query('token') token: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    await this.authenticateAdmin(token);

    const lastSeq = lastEventId ? Number(lastEventId) : undefined;
    const history$ = from(this.trapReceiver.getLogSince(lastSeq));
    const live$ = this.trapReceiver.log$;

    return concat(history$, live$).pipe(map((entry) => ({ data: entry, id: String(entry.seq) })));
  }

  private async authenticateAdmin(token: string) {
    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Acesso restrito a administradores');
    }
  }
}
