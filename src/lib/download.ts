import { saveAs } from "file-saver";
import JSZip from "jszip";
import type { ZipEntry } from "../types";

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes).slice().buffer], {
    type: "application/pdf",
  });
  saveAs(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename);
}

export async function downloadAsZip(entries: ZipEntry[], zipName: string) {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.bytes);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, zipName);
}

export async function downloadBlobsAsZip(
  entries: { name: string; blob: Blob }[],
  zipName: string,
) {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, entry.blob);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, zipName);
}
