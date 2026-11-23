export const orderLabels = {
  PENDIENTE_PAGO: "Pendiente de pago", PAGADO: "Pagado", PREPARANDO: "En preparación",
  LISTO_PARA_ENVIO: "Listo para envío", ENVIADO: "En reparto", ENTREGADO: "Entregado", CANCELADO: "Cancelado",
} as const;
export type OrderState = keyof typeof orderLabels;
export function orderLabel(status: OrderState, pickup: boolean) {
  return pickup && status === "LISTO_PARA_ENVIO" ? "Listo para recoger" : orderLabels[status];
}
export function nextOrderState(status: OrderState, pickup: boolean): OrderState | undefined {
  switch (status) {
    case "PENDIENTE_PAGO": return "CANCELADO";
    case "PAGADO": return "PREPARANDO";
    case "PREPARANDO": return "LISTO_PARA_ENVIO";
    case "LISTO_PARA_ENVIO": return pickup ? "ENTREGADO" : "ENVIADO";
    case "ENVIADO": return "ENTREGADO";
  }
}
