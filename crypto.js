// 暗号化データの復号と、端末への鍵保存。
// 合言葉そのものは保存しない。導出した鍵を「取り出し不可」の CryptoKey として IndexedDB に置く。
const Vault = (() => {
  const DB = "kakei", STORE = "k", ID = "key";
  const u8 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  async function deriveKey(pass, enc) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: u8(enc.salt), iterations: enc.iter },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }

  async function decrypt(enc, key) {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: u8(enc.iv) }, key, u8(enc.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  return {
    async fetchEnc() {
      const r = await fetch("data.enc.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("データを取得できませんでした");
      return r.json();
    },
    async savedKey() {
      try { return await idb("readonly", (s) => s.get(ID)); } catch { return null; }
    },
    async unlockWithSaved(enc) {
      const key = await this.savedKey();
      if (!key) return null;
      try { return await decrypt(enc, key); } catch { return null; } // 合言葉が変わった等
    },
    async unlock(enc, pass) {
      const key = await deriveKey(pass.trim(), enc);
      const data = await decrypt(enc, key); // 合言葉違いはここで例外
      try { await idb("readwrite", (s) => s.put(key, ID)); } catch { /* 保存できない端末でも閲覧は続ける */ }
      return data;
    },
    async forget() {
      try { await idb("readwrite", (s) => s.delete(ID)); } catch { }
    },
  };
})();
