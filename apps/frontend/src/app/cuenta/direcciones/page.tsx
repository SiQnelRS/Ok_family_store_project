import type { Metadata } from "next";
import { AddressBook } from "../../../components/address-book";
export const metadata: Metadata = {title: "Mis direcciones", robots: {index: false, follow: false}};
export default function AddressesPage() { return <AddressBook />; }
