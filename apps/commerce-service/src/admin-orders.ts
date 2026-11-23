import { Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { createDatabaseClient, finishCatalogReservation } from "@ok-family/database";
import { AdminGuard, AdminIdDto, OrderListDto, OrderChangeDto, serviceUrl } from "@ok-family/service-kit";
import type { AdminRequest } from "@ok-family/service-kit";
import { nextOrderState } from "@ok-family/shared";

@Injectable()
export class AdminOrders {
  private client?: ReturnType<typeof createDatabaseClient>;
  private get db() { return this.client ??= createDatabaseClient(); }
  async onModuleDestroy() { await this.client?.$disconnect(); }

  async list({page = 1, status}: OrderListDto) {
    const orders = await this.db.order.findMany({
      where: {status}, orderBy: [{createdAt:"desc"}, {id:"desc"}], skip: (page-1)*20, take: 21,
      include: {items:true, operations:{orderBy:{createdAt:"desc"}}},
    });
    const rows = orders.slice(0,20);
    const users = await this.db.user.findMany({where:{id:{in:rows.map(row => row.userId)}},select:{id:true,name:true,email:true}});
    const reservations = await this.db.reservation.findMany({where:{orderId:{in:rows.map(row => row.id)}},select:{orderId:true,status:true,expiresAt:true}});
    return {hasMore: orders.length > 20, items: rows.map(row => ({
      id:row.id, status:String(row.status), createdAt:row.createdAt, totalInCents:row.totalInCents, shippingInCents:row.shippingInCents,
      destination:row.shippingAddressSnapshot, items:row.items.map(i=>({name:i.productName,quantity:i.quantity,amount:i.subtotalInCents})),
      customer:users.find(user=>user.id===row.userId), reservation:reservations.find(r=>r.orderId===row.id)?.status.toString(),
      operations:row.operations.map(op=>({status:String(op.next),date:op.createdAt})),
    }))};
  }

  async change(id: string, actorId: string, input: OrderChangeDto) {
    return this.db.$transaction(async tx => {
      const order = await tx.order.findUnique({where:{id}});
      if (!order) throw new NotFoundException("Pedido no encontrado.");
      const destination = order.shippingAddressSnapshot;
      const pickup = destination && typeof destination === "object" && !Array.isArray(destination) && destination.method === "pickup";
      if (order.status !== input.previous || nextOrderState(order.status, !!pickup) !== input.next)
        throw new ConflictException("El estado del pedido cambió o la acción no está disponible. Actualiza la lista.");
      if (input.next === "CANCELADO" && !await finishCatalogReservation(tx,id,"LIBERADA",new Date()))
        throw new ConflictException("La reserva ya no está activa. Actualiza la lista.");
      const updated = await tx.order.updateMany({where:{id,status:input.previous},data:{status:input.next}});
      if (!updated.count) throw new ConflictException("Otra persona ya actualizó este pedido.");
      await tx.orderOperation.create({data:{orderId:id,actorId,previous:input.previous,next:input.next}});
      return {ok:true};
    });
  }
}
@Controller("admin/orders")
@UseGuards(AdminGuard)
class AdminOrdersController {
  constructor(private readonly orders: AdminOrders) {}
  @Get() list(@Query() query: OrderListDto) {return this.orders.list(query);}
  @Patch(":id") change(@Param() params: AdminIdDto, @Body() input: OrderChangeDto, @Req() req: AdminRequest) {
    return this.orders.change(params.id,req.admin.id,input);
  }
}
@Module({controllers:[AdminOrdersController],providers:[AdminOrders,AdminGuard,{
  provide:"ADMIN_AUTH_URL",useFactory:()=>serviceUrl("AUTH_SERVICE_URL","http://127.0.0.1:4001"),
}]})
export class AdminOrdersModule {}
