# DocuStudio SaaS — Staff & Operator User Guide

A practical daily guide for studio staff, counter operators, and print technicians using DocuStudio.

---

## 1. Daily Workflow Overview

```
Customer Arrives
   │
   ├─► 1. Lookup / Register Customer in Customers CRM (`/customers`)
   ├─► 2. Process Required Service:
   │      ├─► Passport Photo Studio (`/studio/passport`)
   │      ├─► Document A4 Scan & Photocopy (`/studio/document`)
   │      ├─► Smart NID / ID Card Duplex (`/studio/id-card`)
   │      ├─► CV / Resume Generator (`/studio/cv`)
   │      └─► Handwriting OCR to Word (`/studio/ocr`)
   ├─► 3. Send Order to Live Spooler Queue (`/printers`)
   └─► 4. Collect Payment & Deliver Printed Document / Photo Sheet
```

---

## 2. Using the Passport Photo Studio (`/studio/passport`)

1. **Upload Photo:** Drag & drop customer camera image or capture live.
2. **Choose Preset:**
   - **Bangladesh Passport / NID (40x50 mm):** Official standard.
   - **US Passport (2x2 in / 51x51 mm):** Square format with face guides.
   - **UK / Schengen (35x45 mm):** Light grey background.
   - **BD Stamp Size (20x25 mm):** Standard stamp format.
   - **Combo Pack:** 4 Passport + 4 Stamp copies on 4x6" paper.
3. **Edit & Adjust:** Rotate, crop to face alignment guides, adjust brightness and contrast.
4. **Background Replacement:** Choose white, off-white, light blue, or custom color.
5. **Print Layout:** Select **4x6" Photo Sheet** (up to 8 copies) or **A4 Sheet** (up to 32 copies) with precision dotted cut lines.
6. **Export / Print:** Click **Print to Spooler** or **Download PDF**.

---

## 3. Document A4 Scanning & Photocopy (`/studio/document`)

1. **Upload Document:** Upload mobile photos or scanner images of certificates, deeds, or marks sheets.
2. **Select Enhancement Filter:**
   - **Magic Color:** Removes yellow cast and sharpens colored stamps and seals.
   - **B&W Photocopy:** High-contrast binary threshold for crisp black text.
   - **Grayscale:** Smooth gray tones for official forms.
   - **Shadow Reduction:** Cleans corner shadows from mobile camera photos.
3. **Deskew & Crop:** Straighten skewed scans.
4. **A4 Composition:** Automatically centers on true 300 DPI A4 canvas with configurable margins.
5. **Multi-Page Bundling:** Add multiple pages and export as a single combined PDF.

---

## 4. Smart NID & ID Card Duplex (`/studio/id-card`)

1. Upload **Front Side** and **Back Side** images.
2. Select card preset (**Smart NID 85.6x54 mm** or **Old Laminate NID 105x74 mm**).
3. System aligns front and back with standard border radius.
4. Choose layout:
   - **Side-by-Side:** Front and back aligned horizontally.
   - **Duplex / 4 Copies:** Repeats cards for batch printing on glossy or cardstock paper.
5. Click **Download 300 DPI PDF**.

---

## 5. CV Builder & Ready Documents (`/studio/cv`)

1. Fill customer personal details, education, work experience, and skills.
2. Supports **Bangla (বাংলা)** and **English** font rendering.
3. Choose template and color theme.
4. Preview live and export to vector PDF.
5. Ready document templates available for **House Rent Agreements**, **Job Applications**, and **Experience Certificates**.

---

## 6. Handwriting to Word OCR (`/studio/ocr`)

1. Upload image of handwritten or printed text.
2. System enhances contrast and runs bilingual OCR (Bangla and English).
3. Review extracted text side-by-side with original image.
4. Make manual corrections in the editor.
5. Export directly as an editable **Microsoft Word document (`.docx`)** or **PDF**.

---

## 7. Print Spooler Queue (`/printers`)

1. View all active print jobs waiting for output.
2. Jobs display customer name, phone, copies, and target printer (Photo vs. LaserJet).
3. **Duplicate Prevention:** If a job was recently printed, the system warns the operator to prevent accidental double-printing.
4. Click **Start Print** to change status to `PRINTING`, and **Complete** once physically output.

