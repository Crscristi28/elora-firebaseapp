# Gemini Models - Implementace a Budoucí Plány

## Dokončeno (28.11.2025)

### 1. Thinking konfigurace
- **gemini-2.5-flash**: `thinkingBudget: -1` (dynamický) + `includeThoughts: true`
- **gemini-3-pro-preview**: `thinkingLevel: "low"` + `includeThoughts: true`

### 2. Output limity
- Oba modely: `maxOutputTokens: 65536` (64k max podle Google dokumentace)

### 3. Tools pro Pro model
- `googleSearch` - funguje ✅
- `codeExecution` - funguje ✅ (matematika, výpočty)
- `urlContext` - funguje ✅ (analýza URL)

---

## Budoucí úkoly (TODO)

### 1. Code Execution - Zobrazení kódu a výsledků
**Problém:** Model spouští Python kód, ale my nezobrazujeme:
- `part.executable_code` - samotný kód co model napsal
- `part.code_execution_result` - výstup/výsledek kódu

**Řešení:**
```typescript
// V streaming loop přidat:
if (part.executableCode) {
    const codeBlock = `\n\`\`\`python\n${part.executableCode.code}\n\`\`\`\n`;
    res.write(`data: ${JSON.stringify({ text: codeBlock })}\n\n`);
}
if (part.codeExecutionResult) {
    const resultBlock = `\n**Výsledek:**\n\`\`\`\n${part.codeExecutionResult.output}\n\`\`\`\n`;
    res.write(`data: ${JSON.stringify({ text: resultBlock })}\n\n`);
}
```

**Dokumentace:** https://ai.google.dev/gemini-api/docs/code-execution

---

### 2. Obrázky - KRITICKÝ PROBLÉM (Image Gen + Code Execution)

**Aktuální problémy:**
1. **Obrázky se nezobrazují v chatu** - po změnách ve streaming se rozbilo
2. **Obrázky se neukládají do Storage** - base64 jde přímo do Firestore (špatně!)
3. **Code execution grafy** - `part.inlineData` se vůbec nezpracovává ve streaming

**Co je potřeba:**
1. Opravit zobrazení obrázků v chatu (frontend?)
2. Implementovat upload do Firebase Storage místo base64 do Firestore
3. Přidat zpracování `inlineData` pro code execution grafy

**Správný flow by měl být:**
```
Model vrátí base64 → Upload do Firebase Storage → Vrátit Storage URL → Uložit URL do Firestore
```

**POZOR:** Toto vyžaduje změny v:
- `functions/src/index.ts` - backend zpracování
- Frontend komponenty - zobrazení obrázků
- Možná storage rules

---

### 3. Gemini 3 Pro - Další features (z dokumentace)
**Dostupné ale neimplementované:**
- **Vertex AI RAG Engine** - pro vlastní knowledge base
- **Context Caching** - úspora tokenů při opakovaných dotazech
- **Implicit Caching** - automatické cachování
- **Structured Output** - JSON schema validace
- **media_resolution** parametr - kontrola kvality zpracování obrázků/videí (low/medium/high)

**Dokumentace:** https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini

---

### 4. System Prompt pro modely
**Aktuální stav:** Žádný dedikovaný system prompt pro jednotlivé modely.

**Plán:**
- Vytvořit system prompt pro Pro model který vysvětlí jeho schopnosti (code execution, URL context)
- Možná personality/branding pro Eloru

---

## Poznámky z dokumentace

### thinkingLevel vs thinkingBudget
- **NELZE použít oba zároveň** - vrátí 400 error
- Gemini 2.5 série: `thinkingBudget` (číslo nebo -1)
- Gemini 3 série: `thinkingLevel` ("low" nebo "high")

### Token limity (z Vertex AI Model Garden)
| Model | Input | Output |
|-------|-------|--------|
| gemini-2.5-flash | 1,048,576 | 65,536 |
| gemini-3-pro-preview | 1,000,000 | 65,536 |

### Code Execution omezení
- Pouze Python
- Omezené knihovny (sympy, matplotlib, numpy, pandas...)
- Max výstup: obrázky přes matplotlib
- Nelze instalovat vlastní balíčky
