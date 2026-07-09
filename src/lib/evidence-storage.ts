import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { supabase } from "./supabase-server";

/** Where screenshot bytes live. Local dev uses the repo; Vercel uses
 * Supabase Storage (serverless FS is read-only and ephemeral). */
function useRemoteStorage(): boolean {
  return Boolean(process.env.VERCEL && process.env.SUPABASE_URL);
}

function localEvidenceDir(): string {
  const base = process.env.VERCEL ? os.tmpdir() : process.cwd();
  return path.join(base, ".evidence");
}

async function persistShotsLocal(shots: string[]): Promise<string[]> {
  const dir = localEvidenceDir();
  await mkdir(dir, { recursive: true });
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return Promise.all(
    shots.map(async (b64, i) => {
      const name = `${stamp}-${i}.jpg`;
      await writeFile(path.join(dir, name), Buffer.from(b64, "base64"));
      return `/api/evidence/${name}`;
    })
  );
}

async function persistShotsRemote(shots: string[]): Promise<string[]> {
  const db = supabase();
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const urls: string[] = [];

  for (let i = 0; i < shots.length; i++) {
    const name = `${stamp}-${i}.jpg`;
    const body = Buffer.from(shots[i], "base64");
    const { error } = await db.storage.from("evidence").upload(name, body, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) {
      throw new Error(`evidence upload failed: ${error.message}`);
    }
    const { data } = db.storage.from("evidence").getPublicUrl(name);
    urls.push(data.publicUrl);
  }
  return urls;
}

export async function persistShots(shots: string[]): Promise<string[]> {
  if (useRemoteStorage()) return persistShotsRemote(shots);
  return persistShotsLocal(shots);
}

/** Read a locally stored evidence file (dev / fallback). */
export function localEvidencePath(file: string): string {
  return path.join(localEvidenceDir(), file);
}

export function isRemoteEvidenceUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
