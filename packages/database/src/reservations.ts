import type { Prisma } from "./generated/client.js";

type Transaction = Prisma.TransactionClient;

export async function holdCatalogUnit(tx: Transaction, productId: string, slug: string, quantity: number) {
  const held = await tx.product.updateMany({
    where: {id: productId, slug, published: true, availableQuantity: {gte: quantity}},
    data: {availableQuantity: {decrement: quantity}, reservedQuantity: {increment: quantity}},
  });
  if (!held.count) return null;
  return tx.product.findUniqueOrThrow({where: {id: productId}});
}

// Call inside the same transaction as the corresponding order status change.
export async function finishCatalogReservation(tx: Transaction, orderId: string, action: "CONFIRMADA" | "LIBERADA" | "EXPIRADA", now: Date) {
  const changed = await tx.reservation.updateMany({
    where: {orderId, status: "ACTIVA", ...(action === "EXPIRADA" ? {expiresAt: {lte: now}} : action === "CONFIRMADA" ? {expiresAt: {gt: now}} : {})},
    data: {status: action},
  });
  if (!changed.count) return false;
  const items = await tx.reservationItem.findMany({where: {reservation: {orderId}}, orderBy: {productId: "asc"}});
  for (const {productId, quantity} of items) {
    await tx.product.update({where: {id: productId}, data: {
      reservedQuantity: {decrement: quantity},
      ...(action === "CONFIRMADA" ? {soldQuantity: {increment: quantity}} : {availableQuantity: {increment: quantity}}),
    }});
  }
  return true;
}
