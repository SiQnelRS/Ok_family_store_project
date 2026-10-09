import test from "node:test";
import assert from "node:assert/strict";
import { getAvailability, formatMoney } from "../packages/shared/dist/index.js";

test("una publicación con unidades libres sigue disponible aunque tenga reservas", () => {
  assert.equal(getAvailability(1, 2), "DISPONIBLE");
});
test("una última unidad reservada no se anuncia como vendida", () => {
  assert.equal(getAvailability(0, 1), "RESERVADO");
  assert.equal(getAvailability(0, 0), "VENDIDO");
});
test("el formato monetario conserva centavos", () => {
  assert.match(formatMoney(75050), /750[.,]50/);
});
