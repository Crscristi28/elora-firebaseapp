# Stilq Upload System - Technická dokumentace

> **Verze:** 1.0
> **Datum:** 21.12.2025
> **Autoři:** Claude + Cristian

---

## Přehled architektury

Stilq používá **Unified Upload** systém s paralelním uploadem do dvou služeb:

```
┌─────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Frontend  │───▶│  unifiedUpload (CF)  │───▶│  Firebase Storage   │ (storageUrl)
│  InputArea  │    │                      │───▶│  Google AI File API │ (fileUri)
└─────────────┘    └──────────────────────┘    └─────────────────────┘
```

### Proč dva uploady?

| Služba | Účel | Limit |
|--------|------|-------|
| **Firebase Storage** | UI preview, permanentní URL pro uživatele | Unlimited |
| **Google AI File API** | Posílání do Gemini modelu | 2GB per file |

**Problém který řešíme:** Gemini `inlineData` má limit 10MB (base64). Dva obrázky po 5MB = error.

---

## Klíčové soubory

### 1. Frontend: `components/InputArea.tsx`

```typescript
const UNIFIED_UPLOAD_URL = 'https://us-central1-elenor-57bde.cloudfunctions.net/unifiedUpload';

const uploadAttachment = async (
  base64Data: string,
  mimeType: string,
  originalName?: string
): Promise<{ storageUrl: string; fileUri: string }> => {
  // Validate size (20MB limit for Cloud Function payload)
  if (base64Data.length > 28 * 1024 * 1024) {
    throw new Error("File too large (max 20MB)");
  }

  const response = await fetch(UNIFIED_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: originalName || `file_${Date.now()}`,
      mimeType,
      fileBufferBase64: base64Data
    })
  });

  const { storageUrl, fileUri } = await response.json();
  return { storageUrl, fileUri };
};
```

**Po uploadu se nastaví:**
```typescript
setAttachments(prev => prev.map((a, idx) =>
  idx === attachmentIndex ? { ...a, storageUrl, fileUri } : a
));
```

---

### 2. Backend: `functions/src/index.ts`

#### MIME Type Normalization (KRITICKÉ!)

```typescript
// Helper: Normalize MIME type for File API (avoid codeExecution errors)
// Everything that's not media becomes text/plain - model is smart enough to understand content
const getFileApiMimeType = (mimeType: string): string => {
    const isMedia = mimeType.startsWith('image/') ||
                    mimeType.startsWith('video/') ||
                    mimeType.startsWith('audio/') ||
                    mimeType === 'application/pdf';
    return isMedia ? mimeType : 'text/plain';
};
```

**Proč to potřebujeme:**
- JS soubory mají MIME type `application/x-javascript`
- Gemini File API nepodporuje `application/x-*` pro codeExecution tool
- Error: `The mime type: application/x-javascript is not supported for code execution`
- Řešení: Vše co není media → `text/plain`

#### unifiedUpload Cloud Function

```typescript
export const unifiedUpload = onRequest(
  {
    cors: true,
    secrets: ["GEMINI_API_KEY"],
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (req, res) => {
    const { fileName, mimeType, fileBufferBase64 } = req.body;

    // Decode base64 to buffer and write to temp file
    const buffer = Buffer.from(fileBufferBase64, 'base64');
    const tempPath = `/tmp/${Date.now()}_${fileName}`;
    fs.writeFileSync(tempPath, buffer);

    const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);
    const bucket = admin.storage().bucket();

    // PARALLEL UPLOAD: Firebase Storage (for UI) + Google AI File API (for Gemini)
    const [fbUploadResult, aiUploadResult] = await Promise.all([
      // Firebase Storage upload (original MIME type)
      bucket.upload(tempPath, {
        destination: `attachments/${Date.now()}_${fileName}`,
        metadata: { contentType: mimeType }
      }),
      // Google AI File API upload (NORMALIZED MIME type!)
      fileManager.uploadFile(tempPath, {
        mimeType: getFileApiMimeType(mimeType),  // ← KRITICKÉ!
        displayName: fileName,
      })
    ]);

    // Generate signed URL for Firebase Storage (permanent access)
    const [storageUrl] = await fbUploadResult[0].getSignedUrl({
      action: 'read',
      expires: '03-01-2500'  // Permanentní URL
    });

    // Cleanup temp file
    fs.unlinkSync(tempPath);

    res.json({
      storageUrl,
      fileUri: aiUploadResult.file.uri
    });
  }
);
```

#### streamChat - Použití fileUri

```typescript
if (attachments && attachments.length > 0) {
  attachments.forEach((att: ChatAttachment) => {
    if (att.fileUri) {
      // Use File API URI (no size limit, faster)
      // MIME type MUST match what was used in unifiedUpload!
      parts.push({
        fileData: {
          fileUri: att.fileUri,
          mimeType: getFileApiMimeType(att.mimeType),  // ← MUSÍ MATCHOVAT!
        },
      });
    } else if (isInlineDataSupported(att.mimeType)) {
      // Fallback: Send as inlineData (has 10MB limit)
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data,
        },
      });
    } else {
      // Treat as text/code file - decode and send as text
      const decodedText = Buffer.from(att.data, 'base64').toString('utf-8');
      parts.push({
        text: `File: ${att.name}\n\`\`\`${att.mimeType}\n${decodedText}\n\`\`\`\n`
      });
    }
  });
}
```

---

### 3. Types: `types.ts`

```typescript
export interface Attachment {
  mimeType: string;
  data?: string;        // base64 (Local preview, temporary)
  storageUrl?: string;  // Firebase Storage URL (UI, permanent)
  fileUri?: string;     // Google AI File API URI (Gemini, no size limit)
  name?: string;
  isPlaceholder?: boolean;
  aspectRatio?: string;
  isGraph?: boolean;
}
```

---

## One-Shot Design (Historie souborů)

### Jak to funguje

Soubory jsou posílány do Gemini **pouze v aktuálním turnu**. V historii jsou pouze textové zprávy.

#### Frontend posílá historii (`services/geminiService.ts`):

```typescript
history: history.map(msg => ({
  role: msg.role,
  text: msg.text,  // ← Pouze text, NE obsah souboru
  imageUrls: msg.attachments
    ?.filter(att => att.mimeType?.startsWith('image/') && att.storageUrl)
    .map(att => att.storageUrl),  // ← Pouze image URLs pro image-agent
})),
```

#### Backend sestavuje contents (`functions/src/index.ts`):

```typescript
const contents: Content[] = [
  // Historie - pouze TEXT
  ...limitedHistory.map((msg: HistoryMessage) => ({
    role: msg.role,
    parts: [{ text: msg.text }],  // ← Žádné soubory!
  })),
  // Aktuální zpráva - S přílohami
  { role: "user", parts },  // ← Tady jsou fileUri
];
```

#### Frontend ukládá do Firestore (`App.tsx`):

```typescript
const attachmentsForDb = attachments.map(att => ({
  mimeType: att.mimeType,
  storageUrl: att.storageUrl,
  name: att.name
  // NO data field - would exceed Firestore 1MB limit
  // NO fileUri - not needed for history
}));

const newUserMsg: ChatMessage = {
  text: finalText,
  attachments: attachmentsForDb,
};
```

### Proč model "pamatuje" soubory?

Model má kontextové okno 1M+ tokenů. Obsah souboru z prvního turnu zůstává v kontextu, ale **není posílán znovu**.

**Důkaz z logů:**
```json
[
  { "role": "user", "parts": [{ "text": "Co myslíš?" }] },      // ← Pouze TEXT
  { "role": "model", "parts": [{ "text": "Ahoj!..." }] },       // ← Pouze TEXT
  { "role": "user", "parts": [{ "text": "Děkuji" }] }           // ← Pouze TEXT
]
```

---

## Debugging Guide

### Přidání debug logu

```typescript
// Před voláním Gemini API:
console.log("[DEBUG] Full contents for Gemini:", JSON.stringify(contents, null, 2));
```

**Kde hledat logy:** Firebase Console → Functions → Logs

### Časté chyby

| Error | Příčina | Řešení |
|-------|---------|--------|
| `INVALID_ARGUMENT` status 400 | MIME type mismatch | Použít `getFileApiMimeType()` v obou místech |
| `application/x-javascript not supported` | Špatný MIME type | Normalizovat na `text/plain` |
| `PERMISSION_DENIED` pro fileUri | Vertex AI nemá přístup k File API | Použít storageUrl pro image-agent |
| 10MB limit error | Příliš velký inlineData | Použít File API (fileUri) |

---

## Závislosti

### `functions/package.json`

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",  // GoogleAIFileManager
    "@google/genai": "^1.30.0",          // GoogleGenAI
    "firebase-admin": "^12.7.0",
    "firebase-functions": "^5.0.0"
  }
}
```

### Import

```typescript
import { GoogleAIFileManager } from "@google/generative-ai/server";
```

---

## Limity a omezení

| Co | Limit | Poznámka |
|----|-------|----------|
| Cloud Function payload | ~20MB | Base64 zvyšuje o ~33% |
| Firebase Storage | Unlimited | Permanentní URL do 2500 |
| Google AI File API | 2GB per file | Expiruje po 48h |
| Firestore document | 1MB | Proto neukládáme data/base64 |
| Gemini inlineData | 10MB | Obcházíme pomocí fileUri |

---

## Checklist pro změny

Při úpravě upload systému zkontroluj:

- [ ] `getFileApiMimeType()` použit v **obou** místech (unifiedUpload + streamChat)
- [ ] `fileUri` se posílá do backendu v `attachments` array
- [ ] Historie neobsahuje `fileUri` ani `data`
- [ ] Firestore ukládá pouze `storageUrl`, `mimeType`, `name`
- [ ] Error handling pro upload failures

---

## Historie změn

| Datum | Změna |
|-------|-------|
| 21.12.2025 | Initial unified upload implementation |
| 21.12.2025 | MIME type normalization fix |
| 21.12.2025 | Confirmed one-shot design works correctly |
