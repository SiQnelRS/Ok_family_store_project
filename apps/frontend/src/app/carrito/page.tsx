import type { Metadata } from "next";
import { ShoppingCart } from "../../components/shopping-cart";
export const metadata: Metadata = {title: "Mi carrito", robots: {index: false, follow: false}};
export default function CartPage() { return <ShoppingCart />; }
