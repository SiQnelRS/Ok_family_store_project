import {
  BadRequestException,
  Controller,
  Get,
  Param,
  StreamableFile,
  NotFoundException,
} from "@nestjs/common";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { AdminUploadDto } from "@ok-family/service-kit";

export const uploadDirectory = () =>
  resolve(
    process.env.CATALOG_UPLOAD_DIR ||
      fileURLToPath(new URL("../../../.data/uploads/", import.meta.url)),
  );
export async function savePhoto(input: AdminUploadDto) {
  const source = Buffer.from(input.data, "base64");
  if (
    source.length > 4 * 1024 * 1024 ||
    source.toString("base64") !== input.data
  )
    throw new BadRequestException("La foto debe pesar como máximo 4 MB.");
  let output: Buffer;
  try {
    const image = sharp(source, {
      limitInputPixels: 40000000,
      animated: false,
    });
    const metadata = await image.metadata();
    const format = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
    }[input.contentType];
    if (metadata.format !== format || (metadata.pages ?? 1) > 1)
      throw new Error("Unsupported image");
    output = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      "No pudimos leer la fotografía. Usa una imagen JPG, PNG o WebP válida.",
    );
  }
  const filename = randomUUID() + ".webp";
  await mkdir(uploadDirectory(), { recursive: true });
  await writeFile(resolve(uploadDirectory(), filename), output, { flag: "wx" });
  return { url: "/api/media/" + filename, alt: "Fotografía del producto" };
}
@Controller("media")
export class MediaController {
  @Get(":filename")
  async read(@Param("filename") filename: string) {
    if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) throw new NotFoundException();
    let content: Buffer;
    try {
      content = await readFile(resolve(uploadDirectory(), filename));
    } catch {
      throw new NotFoundException("Fotografía no encontrada.");
    }
    return new StreamableFile(content, {
      type: "image/webp",
      disposition: "inline",
    });
  }
}
