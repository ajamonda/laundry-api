import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { CurrentPrincipal } from '../../../../common/auth/current-principal';

const WASH_STAFF_ROOM = 'wash-staff';

@WebSocketGateway({ namespace: '/exception', cors: { origin: '*' } })
export class ExceptionGateway implements OnGatewayConnection {
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
      const payload = this.jwtService.verify<CurrentPrincipal>(raw);

      if (payload.subjectType === 'CUSTOMER' && payload.customerId) {
        void client.join(`customer:${payload.customerId}`);
        return;
      }
      if (payload.subjectType === 'STAFF' && payload.staffRole === 'WASH') {
        void client.join(WASH_STAFF_ROOM);
        return;
      }

      client.disconnect();
    } catch {
      client.disconnect();
    }
  }

  notifyCustomer(customerId: string, event: string, data: unknown): void {
    this.server.to(`customer:${customerId}`).emit(event, data);
  }

  notifyWashStaff(event: string, data: unknown): void {
    this.server.to(WASH_STAFF_ROOM).emit(event, data);
  }
}
