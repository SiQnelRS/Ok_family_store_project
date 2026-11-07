"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProduct, ProductType } from "@ok-family/shared";
import { adminMutation } from "../../lib/admin-client";
import { DeleteProductButton } from "./product-actions";

type Photo = { url: string; alt: string };
export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<ProductType>(product?.type ?? "PRODUCTO");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [price, setPrice] = useState(
    product ? (product.priceInCents / 100).toFixed(2) : "",
  );
  const [quantity, setQuantity] = useState(
    String(product?.availableQuantity ?? 1),
  );
  const [pieces, setPieces] = useState(String(product?.piecesPerUnit ?? 1));
  const [published, setPublished] = useState(product?.published ?? false);
  const [isDemo, setIsDemo] = useState(product?.isDemo ?? false);
  const [photos, setPhotos] = useState<Photo[]>(product?.images ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const locked = Boolean(
    product && (product.reservedQuantity > 0 || product.soldQuantity > 0),
  );
  useEffect(() => {
    if (!dirty || busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  function chooseType(value: ProductType) {
    setType(value);
    setPieces(
      value === "PRODUCTO" ? "1" : String(Math.max(2, Number(pieces) || 2)),
    );
    setDirty(true);
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (!files.length) return;
    setError("");
    if (photos.length + files.length > 6) {
      setError("Puedes agregar hasta 6 fotografías por producto.");
      event.currentTarget.value = "";
      return;
    }
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 4 * 1024 * 1024,
      )
    ) {
      setError("Usa fotos JPG, PNG o WebP de hasta 4 MB cada una.");
      event.currentTarget.value = "";
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]!);
          reader.onerror = () => reject(new Error("No pudimos leer la foto."));
          reader.readAsDataURL(file);
        });
        const photo = await adminMutation<Photo>("images", "POST", {
          contentType: file.type,
          data: encoded,
        });
        setPhotos((previous) => [
          ...previous,
          {
            ...photo,
            alt: name.trim() ? name.trim().slice(0, 200) : photo.alt,
          },
        ]);
        setDirty(true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos subir la foto.",
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalized = price.trim().replace(",", ".");
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) {
      setError(
        "Escribe el precio en pesos, con hasta dos decimales. Por ejemplo: 950.00",
      );
      return;
    }
    const [whole, fraction = ""] = normalized.split(".");
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    if (cents < 1 || cents > 2147483647) {
      setError("El precio debe ser mayor a cero y no superar $21,474,836.47.");
      return;
    }
    if (published && photos.length === 0) {
      setError(
        "Agrega al menos una fotografía antes de mostrar el producto en la tienda.",
      );
      fileInput.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const input = {
        name,
        description,
        category,
        type,
        piecesPerUnit: type === "PRODUCTO" ? 1 : Number(pieces),
        priceInCents: cents,
        availableQuantity: Number(quantity),
        published,
        isDemo,
        images: photos,
        ...(product ? { updatedAt: product.updatedAt } : {}),
      };
      await adminMutation<AdminProduct>(
        "products" + (product ? "/" + product.id : ""),
        product ? "PATCH" : "POST",
        input,
      );
      setDirty(false);
      router.push("/admin?done=" + (product ? "saved" : "created"));
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar el producto.",
      );
      setBusy(false);
    }
  }
  function cancel(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      dirty &&
      !window.confirm(
        "Tienes cambios sin guardar. ¿Quieres salir sin guardarlos?",
      )
    )
      event.preventDefault();
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <Link className="admin-back" href="/admin" onClick={cancel}>
            ← Mis productos
          </Link>
          <h1>{product ? "Editar producto" : "Agregar producto"}</h1>
          <p>
            {product
              ? "Actualiza los datos y guarda cuando todo esté listo."
              : "Una foto y una buena descripción ayudan a vender mejor."}
          </p>
        </div>
      </div>
      <form
        onSubmit={submit}
        onChange={() => setDirty(true)}
        className="admin-product-form"
        aria-busy={busy || uploading}
      >
        <fieldset disabled={busy} className="admin-form-fields">
          <div className="admin-editor-grid">
            <section
              className="admin-card admin-data-card"
              aria-labelledby="product-data"
            >
              <h2 id="product-data">Datos del producto</h2>
              <fieldset className="admin-sale-type" disabled={locked}>
                <legend>¿Cómo lo vendes?</legend>
                <div>
                  {(["PRODUCTO", "LOTE"] as const).map((value) => (
                    <label
                      key={value}
                      className={type === value ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={value}
                        checked={type === value}
                        onChange={() => chooseType(value)}
                      />
                      <span>
                        {value === "PRODUCTO"
                          ? "Producto individual"
                          : "Lote completo"}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="admin-hint">
                  {type === "LOTE"
                    ? "El cliente compra todas las piezas juntas por un solo precio."
                    : "Una unidad corresponde a un solo producto."}
                  {locked
                    ? " La modalidad está protegida porque ya tiene movimientos."
                    : ""}
                </p>
              </fieldset>
              <div className="admin-field">
                <label htmlFor="product-name">
                  Nombre del {type === "LOTE" ? "lote" : "producto"}{" "}
                  <span aria-hidden="true">*</span>
                </label>
                <input
                  id="product-name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={180}
                  placeholder={
                    type === "LOTE"
                      ? "Ej. Lote de 8 blusas talla M"
                      : "Ej. Tenis deportivos talla 25"
                  }
                />
              </div>
              <div className="admin-field">
                <label htmlFor="product-description">
                  {type === "LOTE" ? "¿Qué incluye el lote?" : "Descripción"}{" "}
                  <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="product-description"
                  name="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  minLength={3}
                  maxLength={5000}
                  rows={4}
                  placeholder="Cuenta la talla, el color, el estado y cualquier detalle que deba conocer el cliente."
                />
              </div>
              <div className="admin-field">
                <label htmlFor="product-category">
                  Categoría <span aria-hidden="true">*</span>
                </label>
                <input
                  id="product-category"
                  name="category"
                  list="product-categories"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  maxLength={80}
                  required
                  placeholder="Ej. Ropa, Calzado o Hogar"
                />
                <datalist id="product-categories">
                  <option value="Ropa" />
                  <option value="Calzado" />
                  <option value="Hogar" />
                </datalist>
                <p className="admin-hint">
                  Puedes elegir una sugerencia o escribir otra categoría.
                </p>
              </div>
              <div className="admin-field-row">
                <div className="admin-field">
                  <label htmlFor="product-price">
                    Precio{" "}
                    {type === "LOTE" ? "del lote completo" : "por unidad"} (MXN){" "}
                    <span aria-hidden="true">*</span>
                  </label>
                  <div className="admin-money-input">
                    <span>$</span>
                    <input
                      id="product-price"
                      name="price"
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      required
                      maxLength={11}
                      placeholder="0.00"
                      aria-describedby="price-help"
                    />
                  </div>
                  <p id="price-help" className="admin-hint">
                    Escribe pesos, por ejemplo 950.00.
                  </p>
                </div>
                <div className="admin-field">
                  <label htmlFor="product-quantity">
                    {type === "LOTE"
                      ? "Lotes disponibles"
                      : "Unidades disponibles"}{" "}
                    <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="product-quantity"
                    name="quantity"
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    required
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                  <p className="admin-hint">
                    Pon 0 cuando no tengas existencias.
                  </p>
                </div>
              </div>
              {type === "LOTE" && (
                <div className="admin-field">
                  <label htmlFor="product-pieces">
                    Piezas dentro de cada lote <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="product-pieces"
                    name="pieces"
                    type="number"
                    min={2}
                    max={10000}
                    step={1}
                    required
                    disabled={locked}
                    value={pieces}
                    onChange={(event) => setPieces(event.target.value)}
                  />
                  <p className="admin-hint">
                    Ejemplo: 1 lote disponible con 8 blusas se vende completo
                    por el precio indicado.
                  </p>
                </div>
              )}
            </section>
            <aside className="admin-editor-aside">
              <section
                className="admin-card admin-photo-card"
                aria-labelledby="photos-title"
              >
                <h2 id="photos-title">Fotografías</h2>
                <label
                  className={
                    "admin-upload-zone" + (uploading ? " uploading" : "")
                  }
                  htmlFor="product-photos"
                >
                  <span aria-hidden="true">+</span>
                  <strong>
                    {uploading
                      ? "Subiendo fotografías…"
                      : "Agregar fotografías"}
                  </strong>
                  <span>Elige desde tu equipo o teléfono</span>
                  <input
                    ref={fileInput}
                    id="product-photos"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={upload}
                    disabled={uploading || photos.length >= 6}
                  />
                </label>
                <p className="admin-hint">
                  Hasta 6 fotos · JPG, PNG o WebP · Máximo 4 MB cada una.
                </p>
                {photos.length > 0 && (
                  <ol className="admin-photo-list">
                    {photos.map((photo, index) => (
                      <li key={photo.url}>
                        <img
                          src={photo.url}
                          alt={photo.alt}
                          width={100}
                          height={100}
                        />
                        <div>
                          <span>
                            {index === 0
                              ? "Foto principal"
                              : "Fotografía " + (index + 1)}
                          </span>
                          {index > 0 && (
                            <button
                              type="button"
                              className="admin-text-button"
                              disabled={uploading}
                              onClick={() => {
                                setPhotos((previous) => [
                                  previous[index]!,
                                  ...previous.filter((_, i) => i !== index),
                                ]);
                                setDirty(true);
                              }}
                            >
                              Usar como portada
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-text-button admin-danger"
                            disabled={uploading}
                            aria-label={"Quitar fotografía " + (index + 1)}
                            onClick={() => {
                              setPhotos((previous) =>
                                previous.filter((_, i) => i !== index),
                              );
                              setDirty(true);
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section className="admin-card admin-publication-card">
                <h2>En tu tienda</h2>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(event) => setPublished(event.target.checked)}
                  />
                  <span>
                    <strong>Mostrar en la tienda</strong>
                    <small>
                      {published
                        ? "Los clientes podrán ver este producto al guardar."
                        : "Se guardará oculto. Solo tú podrás verlo en el panel."}
                    </small>
                  </span>
                </label>
                <label className="admin-check admin-demo-check">
                  <input
                    type="checkbox"
                    checked={isDemo}
                    onChange={(event) => setIsDemo(event.target.checked)}
                  />
                  <span>
                    <strong>Es un producto de prueba</strong>
                    <small>
                      Se mostrará la etiqueta «Ejemplo» para distinguirlo del
                      inventario real.
                    </small>
                  </span>
                </label>
              </section>
            </aside>
          </div>
        </fieldset>
        {error && (
          <div className="admin-alert" role="alert">
            {error}{" "}
            {error.includes("sesión") && (
              <Link href="/admin/ingresar">Ingresar nuevamente</Link>
            )}
          </div>
        )}
        <div className="admin-save-bar">
          <p>
            {uploading
              ? "Espera a que terminen de subir tus fotos."
              : "Los cambios se aplican al guardar."}
          </p>
          <div>
            <Link
              href="/admin"
              className="button button-secondary"
              onClick={cancel}
            >
              Cancelar
            </Link>
            <button
              className="button"
              type="submit"
              disabled={busy || uploading}
            >
              {busy
                ? "Guardando…"
                : product
                  ? "Guardar cambios"
                  : "Guardar producto →"}
            </button>
          </div>
        </div>
      </form>
      {product && (
        <div className="admin-edit-footer">
          {product.published && (
            <Link
              href={"/productos/" + product.slug}
              target="_blank"
              rel="noreferrer"
            >
              Ver este producto en mi tienda ↗
            </Link>
          )}
          <DeleteProductButton product={product} />
        </div>
      )}
    </>
  );
}
