# DocuStudio SaaS — Known Issues & Technical Limitations

This document transparently records technical boundaries, hardware constraints, and recommended operating guidelines for DocuStudio SaaS.

---

## 1. Local Hardware Printer Control

### Technical Reality:
Modern web browsers (Chrome, Edge, Firefox, Safari) enforce strict sandbox security and do not permit silent, unprompted direct-to-hardware printing without user confirmation.

### Implemented Workflow:
1. **Browser Native Spooling:** Generates pixel-perfect 300 DPI vector PDFs that open directly in the browser's system print dialog.
2. **Downloadable Print-Ready PDF:** Operator can download and print via vendor-specific color management software (e.g. Epson Print Layout, Canon Easy-PhotoPrint).
3. **Local Print Agent Integration:** For enterprise installations requiring background silent printing, a lightweight local print daemon communicates over secure WebSockets on `localhost:9100`.

---

## 2. Handwriting Recognition (OCR) Accuracy

### Technical Reality:
No automated OCR model on the market can guarantee 100% handwriting recognition accuracy across extreme cursive styles, faint ballpoint pen markings, or low-contrast mobile camera photos.

### Implemented Workflow:
- High-contrast grayscale and binarization filters are applied automatically before extraction.
- Both **Bangla (বাংলা)** and **English** extraction models return word-by-word confidence ratings.
- A side-by-side split screen allows the operator to review extracted text against the original raster and make manual corrections before exporting to Word (`.docx`) or PDF.

---

## 3. Large File Handling & Browser Memory

### Technical Reality:
Processing multiple 24+ Megapixel uncompressed RAW images simultaneously inside a single browser tab can trigger browser canvas memory limits (`CanvasRenderingContext2D` out-of-memory).

### Implemented Workflow:
- High-resolution resampling is offloaded to the server-side **Sharp** engine running in native C++ with libvips.
- Client browsers handle lightweight WebGL previews with maximum display dimensions constrained to viewport resolution.

---

## 4. Mobile Responsiveness on Photo Canvas Editor

### Recommended Device:
While the Shop Dashboard, CRM, and Billing modules are fully responsive on mobile devices, precision photo cropping, perspective corner dragging, and A4 print sheet arrangement are optimized for desktop and tablet screens (minimum 1024x768 resolution).

