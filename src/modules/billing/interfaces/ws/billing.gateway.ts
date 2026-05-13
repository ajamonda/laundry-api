import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { CustomerPrincipal } from '../../../../common/auth/current-principal';

@WebSocketGateway({ namespace: '/billing', cors: { origin: '*' } })
export class BillingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.disconnect();
        return;
      }

      const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
      const payload = this.jwtService.verify<CustomerPrincipal>(raw);

      if (payload.subjectType !== 'CUSTOMER' || !payload.customerId) {
        client.disconnect();
        return;
      }

      void client.join(`customer:${payload.customerId}`);
    } catch {
      client.disconnect();
    }
  }

  notifyCustomer(customerId: string, event: string, data: unknown): void {
    this.server.to(`customer:${customerId}`).emit(event, data);
  }
}
