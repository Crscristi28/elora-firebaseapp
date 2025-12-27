# Pro Image Model - Complete Blueprint

## Overview

**Model**: `gemini-3-pro-image-preview` (Stilq Creative)
**Capabilities**: Native image generation, multi-turn editing, Google Search, thinking

## Architecture

```
Frontend (React)
    ↓ POST /streamChat
    ↓ history + newMessage + attachments + modelId
Backend (Cloud Functions)
    ↓ Detect isProImage
    ↓ Build proImageContents (with images as fileData)
    ↓ generateContentStream()
    ↓ Stream: text | thinking | image | sources
Frontend
    ↓ onChunk (text)
    ↓ onThinking (thinking panel)
    ↓ onImage (upload to Storage, display)
```

---

## Key Components

### 1. History with Images (Multi-turn Editing)

Model needs to SEE images from history for editing. Images must be sent as `fileData`, not text URLs.

**File**: `functions/src/index.ts` (lines 657-689)

```typescript
// Build special contents for Pro Image with images as fileData
const proImageContents: Content[] = (history || []).map((msg: HistoryMessage) => {
  const parts: Part[] = [];

  // Add images from history as fileData (model needs to SEE them)
  if (msg.imageUrls && msg.imageUrls.length > 0) {
    msg.imageUrls.forEach((storageUrl, idx) => {
      // Hybrid selector: prefer fileUri if valid (not gai-image://), else storageUrl
      const rawFileUri = msg.imageFileUris?.[idx];
      const isInternalGenerativeUri = rawFileUri?.startsWith('gai-image://');

      // Priority: valid fileUri (File API) → storageUrl (Firebase Storage)
      const finalUri = (rawFileUri && !isInternalGenerativeUri) ? rawFileUri : storageUrl;

      // Dynamic mimeType from history, fallback to webp
      const mimeType = msg.imageMimeTypes?.[idx] || 'image/webp';

      if (finalUri) {
        parts.push({ fileData: { fileUri: finalUri, mimeType } } as Part);
      }
    });
  }

  // Text at the end
  parts.push({ text: msg.text });
  return { role: msg.role, parts };
});

// Add current user message
proImageContents.push(currentUserMsg);
```

**Why Hybrid Selector?**
- User-uploaded images → `fileUri` (File API URL, valid)
- Generated images → `gai-image://` (internal, invalid for API)
- Fallback to `storageUrl` (Firebase Storage, always works)

---

### 2. Frontend Sends Image Data

**File**: `services/geminiService.ts` (lines 45-60)

```typescript
body: JSON.stringify({
  history: history.map(msg => ({
    role: msg.role,
    text: msg.text,
    // storageUrl (Firebase Storage - always valid)
    imageUrls: msg.attachments
      ?.filter(att => att.mimeType?.startsWith('image/') && att.storageUrl)
      .map(att => att.storageUrl),
    // fileUri (File API - preferred if valid)
    imageFileUris: msg.attachments
      ?.filter(att => att.mimeType?.startsWith('image/'))
      .map(att => att.fileUri),
    // mimeType for each image
    imageMimeTypes: msg.attachments
      ?.filter(att => att.mimeType?.startsWith('image/'))
      .map(att => att.mimeType),
  })),
  // ...
})
```

---

### 3. Model Config

**File**: `functions/src/index.ts` (lines 691-702)

```typescript
const proImageResult = await proImageAI.models.generateContentStream({
  model: "gemini-3-pro-image-preview",
  contents: proImageContents,
  config: {
    tools: [{ googleSearch: {} }],           // Enable search
    responseModalities: ['TEXT', 'IMAGE'],   // Enable image output
    topP: 0.95,
    maxOutputTokens: 32768,
    systemInstruction: PRO_IMAGE_SYSTEM_PROMPT,
    thinkingConfig: { includeThoughts: true }, // Capture thinking
  },
});
```

---

### 4. Thinking Capture (Filter Thinking Images!)

**CRITICAL**: When `thinkingConfig` is enabled, model emits thinking parts INCLUDING images.
We must filter thinking images to avoid duplicates and double billing.

**File**: `functions/src/index.ts` (lines 709-739)

```typescript
for (const part of parts) {
  // Detect thinking parts
  const isThought = (part as any).thought === true;

  // THINKING TEXT → thinking panel
  if (isThought && part.text) {
    res.write(`data: ${JSON.stringify({ thinking: part.text })}\n\n`);
    if ((res as any).flush) (res as any).flush();
  }
  // REGULAR TEXT → response
  else if (part.text) {
    res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
    if ((res as any).flush) (res as any).flush();
  }

  // IMAGES - SKIP THINKING IMAGES! (prevents duplicates + 2x billing)
  if ((part as any).inlineData && !isThought) {
    const inlineData = (part as any).inlineData;
    const mimeType = inlineData.mimeType || 'image/png';
    const base64Data = inlineData.data;

    // Detect aspect ratio from generated image
    let aspectRatio = '1:1';
    const dims = getImageDimensionsFromBase64(base64Data);
    if (dims) {
      aspectRatio = calculateAspectRatio(dims.width, dims.height);
    }

    res.write(`data: ${JSON.stringify({
      image: { mimeType, data: base64Data, aspectRatio }
    })}\n\n`);
  }
}
```

---

### 5. Aspect Ratio Detection

Model chooses aspect ratio automatically. We detect it from the generated image.

**File**: `functions/src/index.ts` (lines 82-143)

```typescript
// Get dimensions from base64 image (PNG, JPEG, WebP)
function getImageDimensionsFromBase64(base64: string): { width: number; height: number } | null {
  try {
    const buffer = Buffer.from(base64, 'base64');

    // PNG: magic bytes 0x89 0x50 0x4E 0x47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // JPEG: look for SOF0/SOF2 marker
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] === 0xFF) {
          const marker = buffer[offset + 1];
          if (marker === 0xC0 || marker === 0xC2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          const segmentLength = buffer.readUInt16BE(offset + 2);
          offset += 2 + segmentLength;
        } else {
          offset++;
        }
      }
    }

    // WebP: RIFF....WEBPVP8
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      if (buffer.toString('ascii', 12, 16) === 'VP8 ') {
        const width = buffer.readUInt16LE(26) & 0x3FFF;
        const height = buffer.readUInt16LE(28) & 0x3FFF;
        return { width, height };
      }
      if (buffer.toString('ascii', 12, 16) === 'VP8L') {
        const bits = buffer.readUInt32LE(21);
        const width = (bits & 0x3FFF) + 1;
        const height = ((bits >> 14) & 0x3FFF) + 1;
        return { width, height };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Map dimensions to standard aspect ratio
function calculateAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio >= 2.2) return '21:9';
  if (ratio >= 1.7) return '16:9';
  if (ratio >= 1.4) return '3:2';
  if (ratio >= 1.2) return '4:3';
  if (ratio >= 0.95) return '1:1';
  if (ratio >= 0.8) return '4:5';
  if (ratio >= 0.7) return '3:4';
  if (ratio >= 0.6) return '2:3';
  return '9:16';
}
```

---

### 6. System Prompt

**File**: `functions/src/prompts/pro-image.ts`

Key sections:
- `<capabilities>` - Native image gen, editing, people editing, scene reconstruction
- `<workflow>` - ALWAYS write text first, then generate
- `<image_policy>` - 1 image default, up to 4 on request
- `<multi_turn_editing>` - Use images from history, maintain identity
- `<creative_license>` - Take artistic risks on ambiguous prompts
- `<aspect_ratio_reference>` - Infer from context

---

## Problems Solved

### 1. Duplicate Images (2x billing)

**Problem**: With `thinkingConfig` enabled, model emits image in thinking phase AND final phase.

**Solution**: Filter thinking images with `&& !isThought`

```typescript
// BEFORE (sends ALL images):
if ((part as any).inlineData) {

// AFTER (skips thinking images):
if ((part as any).inlineData && !isThought) {
```

### 2. Model Can't See History Images

**Problem**: Images sent as text URLs, model outputs them as text instead of using them.

**Solution**: Send images as `fileData` with proper `fileUri` and `mimeType`.

### 3. Invalid URLs (400 errors)

**Problem**: Generated images have internal `gai-image://` URIs, invalid for API.

**Solution**: Hybrid selector - prefer `fileUri` if valid, fallback to `storageUrl`.

### 4. Wrong Placeholder Size

**Problem**: Frontend didn't know aspect ratio, showed wrong placeholder.

**Solution**: Detect aspect ratio from base64 image headers, send with response.

---

## Files Modified

| File | Purpose |
|------|---------|
| `functions/src/index.ts` | Pro Image block, streaming, thinking filter |
| `functions/src/prompts/pro-image.ts` | System prompt |
| `services/geminiService.ts` | Send imageUrls, fileUris, mimeTypes |
| `types.ts` | ModelId.PRO_IMAGE enum |

---

## Token Limits

- **Input**: ~100k tokens
- **Output**: ~32k tokens
- **Recommendation**: Limit history to 15-20 messages for image models

```typescript
// Future: add to Pro Image block
const limitedHistory = (history || []).slice(-20);
```

---

## Next Steps (Flash Image)

1. Copy Pro Image block
2. Remove `thinkingConfig` (no thinking)
3. Remove `tools: googleSearch` (no search)
4. Model: `gemini-2.5-flash-image`
5. Keep: history with images, aspect ratio detection
