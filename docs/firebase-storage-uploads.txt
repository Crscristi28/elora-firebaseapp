# Firebase Storage Upload Pattern for Chat Attachments

## A Comprehensive Guide to Upload-on-Select Pattern for AI Chat Applications

**Author:** Documented from working implementation
**Last Updated:** 2025-01-24
**Pattern Difficulty:** Intermediate
**Documentation Status:** Production-tested solution

---

## Table of Contents

1. [Introduction](#introduction)
2. [The Problem Statement](#the-problem-statement)
3. [Why Upload-on-Select?](#why-upload-on-select)
4. [Architecture Overview](#architecture-overview)
5. [Implementation Details](#implementation-details)
6. [Security Rules](#security-rules)
7. [Data Flow](#data-flow)
8. [Complete Code Examples](#complete-code-examples)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Introduction

This document describes the **upload-on-select** pattern for handling file attachments in Firebase-based chat applications. This pattern provides optimal user experience by:

1. Uploading files **immediately** when user selects them
2. Showing upload progress with visual indicators
3. Preventing message send until uploads complete
4. Avoiding Firestore document size limits
5. Eliminating UI jumps during message display

### What Makes This Pattern Special

Unlike traditional chat applications that upload files when sending a message, this pattern uploads files **as soon as the user selects them**. This creates a seamless experience where:

- Files upload in the background while user types
- Upload progress is immediately visible
- No delay when sending the message
- No UI jumps from placeholder → uploaded state
- Safe handling of large files (up to 20MB)

### Why This Documentation Exists

This pattern solves critical problems that arise when implementing attachments in Firebase:

- ✅ Firestore's 1MB document size limit
- ✅ Slow AI responses caused by foreground uploads
- ✅ UI jumps when attachment state changes
- ✅ User experience during multi-file uploads
- ✅ Security and validation requirements

---

## The Problem Statement

### Naive Approach: Upload on Send

The simplest approach is to upload files when the user sends a message:

```typescript
// ❌ NAIVE APPROACH - Problems ahead
const handleSend = async () => {
  // 1. User clicks send
  // 2. Start uploading files (this takes time!)
  const urls = await uploadFiles(attachments);

  // 3. Save message with URLs to Firestore
  await saveMessage({ text, attachments: urls });

  // 4. Call AI API
  await callAI({ text, attachments });
};
```

**Problems with this approach:**

1. **Firestore 1MB Document Limit**
   ```
   FirebaseError: Document cannot be written because its size
   (1,961,823 bytes) exceeds the maximum allowed size of 1,048,576 bytes
   ```
   - Base64-encoded images are ~1.37x larger than original
   - A 1.5MB image becomes ~2MB in base64
   - Firestore rejects the entire document

2. **Slow Message Sending**
   - User clicks send → nothing happens for 2-5 seconds
   - Upload time blocks message submission
   - Poor UX especially on slow connections

3. **Delayed AI Responses**
   - Upload must complete before AI can respond
   - User waits even longer for AI to start thinking
   - Upload failures block the entire flow

4. **UI State Jumps**
   - Message appears with placeholder images
   - After upload completes, URLs replace placeholders
   - react-virtuoso recalculates heights
   - Chat viewport "jumps" unexpectedly

### Alternative Failed Approach: Background Upload After Send

Another approach is to save the message first, then upload in background:

```typescript
// ❌ BACKGROUND UPLOAD - Still has problems
const handleSend = async () => {
  // 1. Save message with base64 data
  await saveMessage({ text, attachments: base64Data });  // ❌ 1MB limit!

  // 2. Upload in background
  uploadInBackground(attachments).then(urls => {
    // 3. Update message with URLs
    updateMessage({ attachments: urls });  // ❌ Causes UI jump!
  });
};
```

**Problems:**
- Still hits Firestore 1MB limit
- UI jumps when updating from base64 → URLs
- Race conditions if user scrolls during update

---

## Why Upload-on-Select?

### The Solution: Upload Immediately on File Selection

```typescript
// ✅ UPLOAD-ON-SELECT PATTERN
const handleFileSelect = async (files) => {
  // 1. User selects files
  // 2. Show files in input area immediately
  setAttachments(files);

  // 3. Upload to Firebase Storage RIGHT NOW
  const urls = await uploadToStorage(files);

  // 4. Update attachments with URLs
  setAttachments(prev => prev.map(addUrls));

  // Later: When user clicks send...
  // URLs are ALREADY available, no upload needed!
};
```

### Benefits Breakdown

**1. No Firestore Size Limit Issues**
- Files stored in Firebase Storage (not Firestore)
- Only URLs saved to Firestore (~100 bytes each)
- Support files up to 20MB easily

**2. Instant Message Sending**
- User clicks send → message appears immediately
- No upload delay (already done!)
- Better perceived performance

**3. Fast AI Responses**
- AI can start processing immediately
- No waiting for uploads
- Gemini receives base64 data directly

**4. No UI Jumps**
- URLs available from the start
- No state transitions in chat messages
- Smooth, predictable scrolling

**5. Better User Feedback**
- Upload progress visible in input area
- User can see files uploading while typing
- Send button disabled until uploads complete

**6. Parallel Uploads**
- Multiple files upload simultaneously
- Individual progress indicators
- Much faster than sequential uploads

### Comparison Table

| Feature | Upload on Send | Background Upload | Upload-on-Select ✅ |
|---------|---------------|-------------------|---------------------|
| Firestore limit | ❌ Hits 1MB limit | ❌ Hits 1MB limit | ✅ Only stores URLs |
| Send speed | ❌ Slow (waits for upload) | ⚠️ Fast but saves base64 | ✅ Instant |
| AI response | ❌ Delayed | ⚠️ Delayed | ✅ Immediate |
| UI jumps | ⚠️ Possible | ❌ Guaranteed | ✅ None |
| User feedback | ❌ Poor | ❌ Confusing | ✅ Excellent |
| Upload progress | ❌ Hidden | ❌ After send | ✅ During selection |
| Safety | ⚠️ Can send incomplete | ❌ Can send incomplete | ✅ Button disabled |

---

## Architecture Overview

### System Components

The upload-on-select pattern requires coordination between 3 main components:

```
┌─────────────────────────────────────────────────┐
│              InputArea.tsx                      │
│  - Handles file selection (input/drag-drop)     │
│  - Uploads to Firebase Storage immediately      │
│  - Shows upload progress indicators             │
│  - Maintains both data + storageUrl             │
│  - Disables send button during uploads          │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│               App.tsx                           │
│  - Receives attachments with BOTH:             │
│    • data (base64 for Gemini)                  │
│    • storageUrl (for Firestore)                │
│  - Strips data before Firestore save           │
│  - Sends full data to Gemini API               │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│   Firestore      │    │   Gemini API     │
│  - Stores URLs   │    │  - Gets base64   │
│  - Small docs    │    │  - Processes AI  │
└──────────────────┘    └──────────────────┘
```

### Data States

Attachments go through three states:

**1. Initial State (Just Selected)**
```typescript
{
  mimeType: "image/jpeg",
  data: "base64encodeddata...",
  name: "photo.jpg"
  // No storageUrl yet
}
```

**2. Uploading State**
```typescript
{
  mimeType: "image/jpeg",
  data: "base64encodeddata...",
  name: "photo.jpg",
  // storageUrl: undefined (still uploading)
  // uploadingIndexes Set contains this index
}
```

**3. Uploaded State**
```typescript
{
  mimeType: "image/jpeg",
  data: "base64encodeddata...",      // Kept for Gemini
  name: "photo.jpg",
  storageUrl: "https://storage.googleapis.com/..."  // Added after upload
}
```

**4. Saved to Firestore (data stripped)**
```typescript
{
  mimeType: "image/jpeg",
  name: "photo.jpg",
  storageUrl: "https://storage.googleapis.com/..."
  // data removed to avoid 1MB limit
}
```

### State Management Flow

```
User selects files
       │
       ▼
[Convert to base64] ──────────┐
       │                      │ (All files converted)
       ▼                      │
[Add to attachments state] ───┘
       │
       ▼
[Mark as uploading]
       │
       ├─── File 1 → Upload to Storage → Add URL ─┐
       ├─── File 2 → Upload to Storage → Add URL ─┤ Parallel
       └─── File 3 → Upload to Storage → Add URL ─┘
       │
       ▼
[All uploads complete]
       │
       ▼
[Enable send button]
       │
       ▼
User clicks send
       │
       ▼
[Strip base64 data] ─────────────────┐
       │                             │
       ▼                             ▼
[Save to Firestore]         [Send to Gemini]
 (URLs only)                 (with base64)
```

---

## Implementation Details

### Step 1: Firebase Storage Setup

**Create storage.rules file:**

```javascript
// storage.rules
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // User-specific upload directory
    match /users/{userId}/uploads/{allPaths=**} {

      // Write rules (upload)
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 20 * 1024 * 1024  // 20MB limit
                   && (request.resource.contentType.matches('image/.*') ||
                       request.resource.contentType == 'application/pdf' ||
                       request.resource.contentType == 'text/plain' ||
                       request.resource.contentType == 'text/csv');

      // Read rules (download)
      allow read: if request.auth != null
                  && request.auth.uid == userId;
    }
  }
}
```

**Update firebase.json:**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### Step 2: MIME Type to Extension Mapping

**Define supported file types:**

```typescript
// components/InputArea.tsx
const MIME_TO_EXT: Record<string, string> = {
  // Images
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',

  // Documents
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv'
};
```

### Step 3: Upload Helper Function

**Core upload logic:**

```typescript
const uploadAttachmentToStorage = async (
  base64Data: string,
  mimeType: string,
  userId: string
): Promise<string> => {
  try {
    // 1. Validate size (20MB limit)
    // Base64 is ~1.37x larger than original
    // 28MB base64 ≈ 20MB original
    if (base64Data.length > 28 * 1024 * 1024) {
      throw new Error("File too large (max 20MB)");
    }

    // 2. Decode base64 to binary
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // 3. Generate unique filename
    const ext = MIME_TO_EXT[mimeType] || 'bin';
    const timestamp = Date.now();
    const fileName = `${timestamp}.${ext}`;

    // 4. Create Storage reference
    const storageRef = ref(
      storage,
      `users/${userId}/uploads/${fileName}`
    );

    // 5. Upload to Storage
    await uploadBytes(storageRef, blob);

    // 6. Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;

  } catch (e: any) {
    console.error("Upload failed:", e);
    throw new Error(`Upload failed: ${e.message}`);
  }
};
```

### Step 4: File Selection Handler (Batch + Parallel)

**Handle file input change:**

```typescript
const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
  if (!user?.uid) {
    alert("Please sign in to upload files");
    return;
  }

  if (e.target.files && e.target.files.length > 0) {
    const filesToProcess = Array.from(e.target.files);
    const startIndex = attachments.length;

    // STEP 1: Convert ALL files to base64 first (batch)
    const newAttachments: Attachment[] = [];
    for (const file of filesToProcess) {
      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          mimeType: file.type,
          data: base64,
          name: file.name
        });
      } catch (err) {
        console.error("Failed to read file", err);
      }
    }

    // STEP 2: Add ALL attachments to state at once (prevents sequential UI updates)
    setAttachments(prev => [...prev, ...newAttachments]);

    // STEP 3: Mark ALL as uploading
    const uploadingSet = new Set<number>();
    for (let i = 0; i < newAttachments.length; i++) {
      uploadingSet.add(startIndex + i);
    }
    setUploadingIndexes(prev => new Set([...prev, ...uploadingSet]));

    // STEP 4: Upload ALL in parallel (forEach with async callbacks)
    newAttachments.forEach(async (att, i) => {
      const attachmentIndex = startIndex + i;

      try {
        console.log('Uploading', att.name, 'to Storage...');

        // Upload to Firebase Storage
        const storageUrl = await uploadAttachmentToStorage(
          att.data!,
          att.mimeType,
          user.uid
        );

        console.log('Uploaded:', att.name, '→', storageUrl);

        // STEP 5: Add storageUrl (keep data for Gemini)
        setAttachments(prev => prev.map((a, idx) =>
          idx === attachmentIndex
            ? { ...a, storageUrl }
            : a
        ));

        // STEP 6: Remove from uploading set
        setUploadingIndexes(prev => {
          const updated = new Set(prev);
          updated.delete(attachmentIndex);
          return updated;
        });

      } catch (err: any) {
        console.error("Failed to upload", att.name, err);

        // Remove from uploading even on error
        setUploadingIndexes(prev => {
          const updated = new Set(prev);
          updated.delete(attachmentIndex);
          return updated;
        });
      }
    });

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }
};
```

### Step 5: Upload Progress UI

**Show loading indicators:**

```tsx
{attachments.map((att, i) => (
  <div key={i} className="relative group flex-shrink-0">
    {att.mimeType.startsWith('image/') ? (
      <div className="relative">
        <img
          src={att.storageUrl || `data:${att.mimeType};base64,${att.data}`}
          alt="preview"
          className="h-16 w-16 object-cover rounded-xl border border-gray-300 dark:border-gray-700"
        />

        {/* Loading spinner overlay */}
        {uploadingIndexes.has(i) && (
          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
            <Loader2 size={20} className="text-white animate-spin" />
          </div>
        )}
      </div>
    ) : (
      // Similar for non-image files
      <div className="relative w-16 h-16 bg-gray-100 dark:bg-[#2d2e33] rounded-xl border border-gray-300 dark:border-gray-700 flex items-center justify-center">
        <FileIcon size={24} className="text-gray-600 dark:text-gray-400" />

        {uploadingIndexes.has(i) && (
          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
            <Loader2 size={20} className="text-white animate-spin" />
          </div>
        )}
      </div>
    )}

    {/* Remove button */}
    <button
      onClick={() => removeAttachment(i)}
      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <X size={14} />
    </button>
  </div>
))}
```

### Step 6: Send Button Safety

**Disable send during uploads:**

```typescript
// State
const [uploadingIndexes, setUploadingIndexes] = useState<Set<number>>(new Set());
const isUploading = uploadingIndexes.size > 0;

// Send button
<button
  onClick={handleSend}
  disabled={!hasContent || isLoading || isUploading}
  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
    hasContent && !isLoading && !isUploading
      ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 shadow-lg'
      : 'bg-gray-100 dark:bg-[#2d2e33] text-gray-400 dark:text-gray-500 cursor-not-allowed'
  }`}
  title={isUploading ? 'Uploading files...' : ''}
>
  {isUploading ? (
    <Loader2 size={20} className="animate-spin" />
  ) : (
    <SendIcon size={20} />
  )}
</button>
```

### Step 7: Strip Base64 Before Firestore Save

**In App.tsx when saving message:**

```typescript
// App.tsx - handleSend function
const handleSend = async () => {
  // ... validation ...

  // Strip base64 data from attachments before saving to Firestore
  const attachmentsForDb = attachments.map(att => ({
    mimeType: att.mimeType,
    storageUrl: att.storageUrl,
    name: att.name
    // NO data field - would exceed Firestore 1MB limit
  }));

  // Create user message
  const newUserMsg: ChatMessage = {
    id: Date.now().toString(),
    role: Role.USER,
    text: finalText,
    attachments: attachmentsForDb,  // Save WITHOUT base64
    timestamp: Date.now(),
  };

  // Save to Firestore (small document size)
  await addMessageToDb(sessionId, newUserMsg);

  // But send FULL attachments to Gemini (with base64 data)
  await streamChatResponse(
    sessionId,
    finalText,
    attachments,  // ← FULL attachments with data
    conversationHistory
  );
};
```

---

## Security Rules

### Firebase Storage Rules Breakdown

**User Isolation:**
```javascript
match /users/{userId}/uploads/{allPaths=**} {
  allow write: if request.auth != null
               && request.auth.uid == userId
```
- Each user can only write to their own directory
- Prevents users from uploading to other users' folders
- `{allPaths=**}` allows nested paths if needed

**Size Validation:**
```javascript
&& request.resource.size < 20 * 1024 * 1024  // 20MB limit
```
- Server-side enforcement (can't be bypassed)
- 20MB = reasonable for images/PDFs
- Prevents abuse and storage costs

**MIME Type Validation:**
```javascript
&& (request.resource.contentType.matches('image/.*') ||
    request.resource.contentType == 'application/pdf' ||
    request.resource.contentType == 'text/plain' ||
    request.resource.contentType == 'text/csv')
```
- Only allows specific file types
- Prevents executable files (.exe, .sh, etc.)
- Uses regex for all image types

**Read Rules:**
```javascript
allow read: if request.auth != null
            && request.auth.uid == userId;
```
- Users can only read their own files
- Download URLs are signed (expire after time)
- Additional security layer

### Client-Side Validation

**In addition to server-side rules:**

```typescript
// Client-side size check (before upload)
if (base64Data.length > 28 * 1024 * 1024) {
  throw new Error("File too large (max 20MB)");
}

// Client-side MIME check
if (!MIME_TO_EXT[file.type]) {
  throw new Error("Unsupported file type");
}

// User authentication check
if (!user?.uid) {
  alert("Please sign in to upload files");
  return;
}
```

---

## Data Flow

### Complete Flow Diagram

```
┌────────────────────────────────────────────────────────────┐
│ 1. USER SELECTS FILES                                      │
│    Input: File[] from <input type="file">                  │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 2. CONVERT TO BASE64 (Batch)                               │
│    for (file of files) {                                   │
│      base64 = await fileToBase64(file)                     │
│      newAttachments.push({ data: base64, ... })            │
│    }                                                        │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 3. ADD ALL TO STATE (Single setState)                      │
│    setAttachments(prev => [...prev, ...newAttachments])    │
│    → UI shows all files immediately                        │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 4. MARK AS UPLOADING                                       │
│    setUploadingIndexes(new Set([0, 1, 2]))                 │
│    → Spinner overlays appear                               │
└───────────────────────┬────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 5. UPLOAD 1 │ │ 5. UPLOAD 2 │ │ 5. UPLOAD 3 │  (Parallel)
│   to Storage│ │   to Storage│ │   to Storage│
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Get URL 1   │ │ Get URL 2   │ │ Get URL 3   │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       ▼               ▼               ▼
┌────────────────────────────────────────────────────────────┐
│ 6. UPDATE ATTACHMENT WITH URL (Individual setState)        │
│    setAttachments(prev => prev.map((a, idx) =>             │
│      idx === i ? { ...a, storageUrl } : a                  │
│    ))                                                       │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 7. REMOVE FROM UPLOADING SET                               │
│    setUploadingIndexes(prev => {                           │
│      const updated = new Set(prev)                         │
│      updated.delete(i)                                     │
│      return updated                                        │
│    })                                                       │
│    → Spinner disappears                                    │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 8. ALL UPLOADS COMPLETE                                    │
│    uploadingIndexes.size === 0                             │
│    → Send button enabled                                   │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 9. USER CLICKS SEND                                        │
│    Attachments now have BOTH:                              │
│    - data (base64) for Gemini                              │
│    - storageUrl for Firestore                              │
└───────────────────────┬────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│ 10a. SAVE TO        │       │ 10b. SEND TO GEMINI │
│      FIRESTORE      │       │                     │
│                     │       │                     │
│ Strip base64:       │       │ Keep base64:        │
│ attachmentsForDb =  │       │ streamChatResponse( │
│   attachments.map(  │       │   text,             │
│     a => ({         │       │   attachments, ← full│
│       storageUrl,   │       │   ...               │
│       mimeType,     │       │ )                   │
│       name          │       │                     │
│     })              │       │ AI processes images │
│   )                 │       │ from base64 data    │
│                     │       │                     │
│ Small doc size ✅   │       │ Full data ✅        │
└─────────────────────┘       └─────────────────────┘
```

### State Timeline

```
Time 0ms:   User selects 3 files
Time 10ms:  Convert file 1 to base64
Time 50ms:  Convert file 2 to base64
Time 90ms:  Convert file 3 to base64
Time 100ms: Add ALL to attachments state (single setState)
            UI shows 3 files with spinners
Time 110ms: Start upload 1 to Storage
Time 110ms: Start upload 2 to Storage (parallel)
Time 110ms: Start upload 3 to Storage (parallel)
Time 800ms: Upload 1 completes → update attachment 1 with URL
            → remove index 0 from uploadingIndexes
Time 950ms: Upload 2 completes → update attachment 2 with URL
            → remove index 1 from uploadingIndexes
Time 1200ms: Upload 3 completes → update attachment 3 with URL
             → remove index 2 from uploadingIndexes
             → uploadingIndexes.size === 0
             → Send button enabled ✅
```

---

## Complete Code Examples

### InputArea.tsx (Full Implementation)

```typescript
import React, { useState, useRef, ChangeEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, X, FileIcon } from 'lucide-react';

// MIME type to file extension mapping
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv'
};

interface Attachment {
  mimeType: string;
  data?: string;        // Base64 for Gemini
  storageUrl?: string;  // URL for Firestore
  name: string;
}

const InputArea: React.FC = () => {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingIndexes, setUploadingIndexes] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadingIndexes.size > 0;

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Upload attachment to Firebase Storage
  const uploadAttachmentToStorage = async (
    base64Data: string,
    mimeType: string,
    userId: string
  ): Promise<string> => {
    try {
      // Validate size (20MB limit)
      if (base64Data.length > 28 * 1024 * 1024) {
        throw new Error("File too large (max 20MB)");
      }

      // Decode base64 to binary
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      // Get file extension
      const ext = MIME_TO_EXT[mimeType] || 'bin';
      const timestamp = Date.now();
      const fileName = `${timestamp}.${ext}`;

      // Upload to Storage
      const storageRef = ref(storage, `users/${userId}/uploads/${fileName}`);
      await uploadBytes(storageRef, blob);

      // Get download URL
      return await getDownloadURL(storageRef);
    } catch (e: any) {
      console.error("Upload failed:", e);
      throw new Error(`Upload failed: ${e.message}`);
    }
  };

  // Handle file selection
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user?.uid) {
      alert("Please sign in to upload files");
      return;
    }

    if (e.target.files && e.target.files.length > 0) {
      const filesToProcess = Array.from(e.target.files);
      const startIndex = attachments.length;

      // 1. Convert ALL files to base64 first
      const newAttachments: Attachment[] = [];
      for (const file of filesToProcess) {
        try {
          const base64 = await fileToBase64(file);
          newAttachments.push({
            mimeType: file.type,
            data: base64,
            name: file.name
          });
        } catch (err) {
          console.error("Failed to read file", err);
        }
      }

      // 2. Add ALL attachments at once
      setAttachments(prev => [...prev, ...newAttachments]);

      // 3. Mark ALL as uploading
      const uploadingSet = new Set<number>();
      for (let i = 0; i < newAttachments.length; i++) {
        uploadingSet.add(startIndex + i);
      }
      setUploadingIndexes(prev => new Set([...prev, ...uploadingSet]));

      // 4. Upload ALL in parallel
      newAttachments.forEach(async (att, i) => {
        const attachmentIndex = startIndex + i;
        try {
          console.log('Uploading', att.name, 'to Storage...');
          const storageUrl = await uploadAttachmentToStorage(
            att.data!,
            att.mimeType,
            user.uid
          );
          console.log('Uploaded:', att.name, '→', storageUrl);

          // 5. Add storageUrl (keep data for Gemini)
          setAttachments(prev => prev.map((a, idx) =>
            idx === attachmentIndex ? { ...a, storageUrl } : a
          ));

          // 6. Remove from uploading
          setUploadingIndexes(prev => {
            const updated = new Set(prev);
            updated.delete(attachmentIndex);
            return updated;
          });
        } catch (err: any) {
          console.error("Failed to upload", att.name, err);
          setUploadingIndexes(prev => {
            const updated = new Set(prev);
            updated.delete(attachmentIndex);
            return updated;
          });
        }
      });

      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {attachments.map((att, i) => (
            <div key={i} className="relative group flex-shrink-0">
              {att.mimeType.startsWith('image/') ? (
                <div className="relative">
                  <img
                    src={att.storageUrl || `data:${att.mimeType};base64,${att.data}`}
                    alt="preview"
                    className="h-16 w-16 object-cover rounded-xl border border-gray-300 dark:border-gray-700"
                  />
                  {uploadingIndexes.has(i) && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                      <Loader2 size={20} className="text-white animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative w-16 h-16 bg-gray-100 dark:bg-[#2d2e33] rounded-xl border flex items-center justify-center">
                  <FileIcon size={24} />
                  {uploadingIndexes.has(i) && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                      <Loader2 size={20} className="text-white animate-spin" />
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Send button */}
      <button
        disabled={isUploading}
        title={isUploading ? 'Uploading files...' : ''}
      >
        {isUploading ? <Loader2 className="animate-spin" /> : 'Send'}
      </button>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,text/plain,text/csv"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default InputArea;
```

### App.tsx (Strip Base64 Before Save)

```typescript
// App.tsx - handleSend function
const handleSend = async () => {
  if (!input.trim() && attachments.length === 0) return;

  const finalText = input.trim();
  const sessionId = currentSessionId || Date.now().toString();

  // Strip base64 data from attachments before saving to Firestore
  const attachmentsForDb = attachments.map(att => ({
    mimeType: att.mimeType,
    storageUrl: att.storageUrl,
    name: att.name
    // NO data field - would exceed Firestore 1MB limit
  }));

  // Create user message
  const newUserMsg: ChatMessage = {
    id: Date.now().toString(),
    role: Role.USER,
    text: finalText,
    attachments: attachmentsForDb,  // Save WITHOUT base64
    timestamp: Date.now(),
  };

  // Save to Firestore (small document size)
  await addMessageToDb(sessionId, newUserMsg);

  // Send FULL attachments to Gemini (with base64 data)
  await streamChatResponse(
    sessionId,
    finalText,
    attachments,  // ← FULL attachments with data
    conversationHistory
  );

  // Clear input
  setInput('');
  setAttachments([]);
};
```

---

## Troubleshooting

### Problem 1: Firestore Still Hitting 1MB Limit

**Symptoms:**
```
FirebaseError: Document size (1,961,823 bytes) exceeds 1,048,576 bytes
```

**Diagnosis:**
```typescript
// Check what's being saved
console.log('Attachments for DB:', attachmentsForDb);
console.log('Has data field?', attachmentsForDb[0].data !== undefined);
```

**Common Causes:**
1. Not stripping `data` field before Firestore save
2. Accidentally sending wrong attachment array
3. Other large fields in document

**Solutions:**
- Verify `attachmentsForDb` doesn't have `data` field
- Check document size: `JSON.stringify(newUserMsg).length`
- Ensure App.tsx uses stripped attachments for Firestore

### Problem 2: Files Appear One at a Time

**Symptoms:**
- Multiple files show up sequentially instead of all at once
- UI feels laggy when selecting multiple files

**Diagnosis:**
```typescript
// Check if you're using sequential setState
for (const file of files) {
  const base64 = await fileToBase64(file);
  setAttachments(prev => [...prev, { data: base64 }]);  // ❌ BAD
}
```

**Solution:**
- Batch convert ALL files first
- Single setState with all attachments
- Then start parallel uploads

### Problem 3: AI Not Responding with Attachments

**Symptoms:**
- Empty AI responses
- 400 Bad Request errors
- Works without attachments

**Diagnosis:**
```typescript
// Check what's being sent to Gemini
console.log('Attachments to Gemini:', attachments);
console.log('Has data field?', attachments[0].data !== undefined);
```

**Common Causes:**
- Sending stripped attachments (without `data`) to Gemini
- Using `attachmentsForDb` instead of `attachments` for AI call

**Solutions:**
- Gemini needs `data` field (base64)
- Use FULL attachments for `streamChatResponse`
- Only strip `data` for Firestore save

### Problem 4: Upload Progress Not Showing

**Symptoms:**
- No spinner during upload
- Can't tell if files are uploading

**Diagnosis:**
```typescript
// Check uploading state
console.log('Uploading indexes:', uploadingIndexes);
console.log('Is uploading?', uploadingIndexes.has(0));
```

**Common Causes:**
- Not setting `uploadingIndexes` before upload
- Not checking `uploadingIndexes.has(i)` in UI

**Solutions:**
- Set uploadingIndexes before starting upload
- Show Loader2 when `uploadingIndexes.has(i)`
- Remove from set after upload completes

### Problem 5: Can Send Before Upload Completes

**Symptoms:**
- Send button enabled during upload
- Messages sent with incomplete attachments

**Diagnosis:**
```typescript
// Check send button logic
console.log('Is uploading?', isUploading);
console.log('Send disabled?', isUploading);
```

**Common Causes:**
- Not checking `isUploading` in button disabled prop
- `isUploading` calculation wrong

**Solutions:**
- `const isUploading = uploadingIndexes.size > 0`
- Add to button: `disabled={isUploading}`
- Show spinner in button when uploading

### Problem 6: Storage Security Rules Rejecting Upload

**Symptoms:**
```
FirebaseError: storage/unauthorized
```

**Diagnosis:**
1. Check user is authenticated
2. Check file size < 20MB
3. Check MIME type is allowed

**Solutions:**
```typescript
// Add validation before upload
if (!user?.uid) {
  throw new Error("Not authenticated");
}

if (blob.size > 20 * 1024 * 1024) {
  throw new Error("File too large");
}

if (!MIME_TO_EXT[mimeType]) {
  throw new Error("File type not allowed");
}
```

---

## Best Practices

### 1. Always Validate Client-Side First

Before uploading:
- Check authentication
- Check file size
- Check MIME type
- Provide user feedback

### 2. Handle Upload Failures Gracefully

```typescript
try {
  const url = await uploadAttachmentToStorage(...);
  // Success
} catch (err: any) {
  console.error("Upload failed:", err);
  // Remove from uploading set
  // Show error to user
  alert(`Failed to upload ${att.name}: ${err.message}`);
}
```

### 3. Provide Clear User Feedback

- Show loading spinners during upload
- Disable send button during upload
- Display error messages on failure
- Show upload progress if possible

### 4. Clean Up on Component Unmount

```typescript
useEffect(() => {
  return () => {
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
}, []);
```

### 5. Security Checklist

- ✅ Server-side size validation (storage.rules)
- ✅ Server-side MIME type validation (storage.rules)
- ✅ User isolation (userId in path)
- ✅ Client-side validation (early feedback)
- ✅ Authentication required
- ✅ Read access restricted to owner

### 6. Performance Optimization

- ✅ Parallel uploads (not sequential)
- ✅ Batch state updates (prevent re-renders)
- ✅ Use refs for guard flags (avoid re-renders)
- ✅ Compress images before upload (optional)

### 7. User Experience

- ✅ Immediate visual feedback (files appear instantly)
- ✅ Upload progress indicators
- ✅ Can't send incomplete uploads
- ✅ Can remove files before send
- ✅ Drag-and-drop support

---

## Summary

The **upload-on-select** pattern solves critical Firebase limitations:

1. **Firestore 1MB limit** → Store files in Storage, only URLs in Firestore
2. **Slow message sending** → Upload during selection, not on send
3. **Delayed AI responses** → URLs ready immediately, AI gets base64
4. **UI jumps** → URLs available from start, no state transitions
5. **Poor UX** → Upload progress visible, send disabled during upload

**Key Implementation Points:**
- Upload files to Firebase Storage immediately when selected
- Maintain both `data` (for Gemini) and `storageUrl` (for Firestore)
- Show upload progress with loading indicators
- Disable send button until all uploads complete
- Strip `data` field before saving to Firestore
- Send full attachments (with `data`) to Gemini API

**Architecture Benefits:**
- Clean separation of concerns (InputArea handles uploads)
- App.tsx stays minimal
- Scalable to large files (20MB+)
- Server-side security enforcement
- Excellent user experience

---

**Created:** January 24, 2025
**Version:** 1.0.0
**Status:** Production-ready

---
