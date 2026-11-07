import "dotenv/config";
import { createDatabaseClient } from "../packages/database/dist/index.js";
import { hashPassword } from "../packages/service-kit/dist/index.js";
import { randomBytes } from "node:crypto";
import { writeFile, access, unlink } from "node:fs/promises";
import { resolve } from "node:path";

if (process.env.NODE_ENV === "production")
  throw new Error(
    "Este comando prepara únicamente el acceso local de desarrollo.",
  );
const db = createDatabaseClient();
const email = (process.env.ADMIN_SETUP_EMAIL || "dueno@okfamily.local")
  .trim()
  .toLowerCase();
const password =
  process.env.ADMIN_SETUP_PASSWORD || randomBytes(24).toString("base64url");
const filename = resolve(".env.admin.local");
try {
  if (await db.user.findUnique({ where: { email } })) {
    console.log(
      "El usuario ya existe. No se modificaron su contraseña ni sus permisos.",
    );
  } else {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      password.length > 128
    )
      throw new Error(
        "Usa un correo válido y una contraseña de 12 a 128 caracteres.",
      );
    try {
      await access(filename);
      throw new Error(
        "Ya existe .env.admin.local; conserva ese acceso antes de crear otro.",
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const passwordHash = await hashPassword(password);
    // El secreto queda solo en un archivo ignorado; nunca se imprime en la terminal.
    let createdFile = false;
    try {
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email,
            name: "Dueño de Ok Family",
            passwordHash,
            role: "ADMIN",
            provider: "EMAIL",
          },
        });
        await writeFile(
          filename,
          "ADMIN_EMAIL=" +
            JSON.stringify(email) +
            "\nADMIN_PASSWORD=" +
            JSON.stringify(password) +
            "\n",
          { flag: "wx", mode: 0o600 },
        );
        createdFile = true;
      });
    } catch (error) {
      if (createdFile) await unlink(filename);
      throw error;
    }
    console.log(
      "Acceso local creado. Consulta el correo y la contraseña en .env.admin.local (archivo no versionado).",
    );
  }
} finally {
  await db.$disconnect();
}
