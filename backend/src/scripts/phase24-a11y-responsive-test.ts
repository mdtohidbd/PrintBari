/**
 * PHASE 24 AUTOMATED VERIFICATION SUITE:
 * ACCESSIBILITY (WCAG 2.2 AA), RESPONSIVE DESIGN & CROSS-BROWSER QUALITY
 */

import fs from 'fs';
import path from 'path';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  error?: string;
  metric?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, test: string, metric?: string) {
  if (condition) {
    results.push({ suite, test, passed: true, metric });
    console.log(`  ✓ [PASS] ${suite} - ${test} ${metric ? `(${metric})` : ''}`);
  } else {
    results.push({ suite, test, passed: false, error: 'Assertion failed', metric });
    console.error(`  ✗ [FAIL] ${suite} - ${test}`);
  }
}

// Helper: Calculate WCAG 2.2 relative luminance and contrast ratio
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function getLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hexToRgb(hex1));
  const lum2 = getLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

async function runPhase24A11yResponsiveTests() {
  console.log('================================================================');
  console.log('  PHASE 24: ACCESSIBILITY, RESPONSIVE & CROSS-BROWSER AUDIT     ');
  console.log('================================================================\n');

  const frontendRoot = path.resolve(__dirname, '../../../frontend');

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: WCAG 2.2 AA Contrast & Visual Accessibility
    // -------------------------------------------------------------
    console.log('--- TEST SUITE 1: Color Contrast & Visual Accessibility ---');

    // 1. Text Primary on White (#0f172a on #ffffff) -> Must exceed 7.0:1 (AAA)
    const ratioTextPrimary = getContrastRatio('#0f172a', '#ffffff');
    assert(
      ratioTextPrimary >= 7.0,
      'Color Contrast',
      'Primary text on white background exceeds WCAG AAA (7.0:1)',
      `${ratioTextPrimary.toFixed(2)}:1`
    );

    // 2. Text Secondary on White (#64748b on #ffffff) -> Must exceed 4.5:1 (AA)
    const ratioTextSecondary = getContrastRatio('#64748b', '#ffffff');
    assert(
      ratioTextSecondary >= 4.5,
      'Color Contrast',
      'Secondary text on white background meets WCAG AA (4.5:1)',
      `${ratioTextSecondary.toFixed(2)}:1`
    );

    // 3. Brand Primary Button text (White on #4f46e5) -> Must exceed 4.5:1 (AA)
    const ratioBrandBtn = getContrastRatio('#ffffff', '#4f46e5');
    assert(
      ratioBrandBtn >= 4.5,
      'Color Contrast',
      'Brand primary button contrast meets WCAG AA',
      `${ratioBrandBtn.toFixed(2)}:1`
    );

    // 4. Rose Danger Button text (White on #e11d48) -> Must exceed 4.5:1 (AA)
    const ratioDangerBtn = getContrastRatio('#ffffff', '#e11d48');
    assert(
      ratioDangerBtn >= 4.5,
      'Color Contrast',
      'Danger action button contrast meets WCAG AA',
      `${ratioDangerBtn.toFixed(2)}:1`
    );

    // 5. Emerald Success Button text (White on #047857 emerald-700) -> Must exceed 4.5:1 (AA)
    const ratioSuccessBtn = getContrastRatio('#ffffff', '#047857');
    assert(
      ratioSuccessBtn >= 4.5,
      'Color Contrast',
      'Success action button contrast meets WCAG AA (emerald-700)',
      `${ratioSuccessBtn.toFixed(2)}:1`
    );

    // -------------------------------------------------------------
    // TEST SUITE 2: CSS Stylesheet Universal Focus & Reduced Motion
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Focus Indicators & Vestibular Motion Support ---');
    const indexCssPath = path.join(frontendRoot, 'src/index.css');
    const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

    // 6. Universal :focus-visible outline defined
    assert(
      indexCss.includes(':focus-visible') && indexCss.includes('outline: 2px solid'),
      'Keyboard Focus',
      'Universal :focus-visible focus ring defined with 2px offset'
    );

    // 7. prefers-reduced-motion media query defined
    assert(
      indexCss.includes('@media (prefers-reduced-motion: reduce)'),
      'Motion Accessibility',
      'WCAG 2.2 SC 2.3.3 Reduced Motion media query implemented'
    );

    // 8. Screen Reader focusable utility (.sr-only-focusable)
    assert(
      indexCss.includes('.sr-only-focusable'),
      'Screen Reader Helper',
      '.sr-only-focusable utility present for skip navigation'
    );

    // -------------------------------------------------------------
    // TEST SUITE 3: Semantic HTML & Skip Links (SC 2.4.1 Bypass Blocks)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Semantic Structure & Skip Links ---');

    // 9. Root index.html lang attribute
    const indexHtml = fs.readFileSync(path.join(frontendRoot, 'index.html'), 'utf-8');
    assert(indexHtml.includes('<html lang="en">'), 'HTML Semantics', 'Document root specifies lang="en"');
    assert(indexHtml.includes('viewport') && indexHtml.includes('width=device-width'), 'Responsive Meta', 'Mobile viewport meta configured');

    // 10. DashboardLayout Skip Link
    const dashboardLayout = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/DashboardLayout.tsx'), 'utf-8');
    assert(
      dashboardLayout.includes('Skip to main content') && dashboardLayout.includes('href="#main-content"'),
      'Bypass Blocks',
      'DashboardLayout implements keyboard Skip-to-main-content link'
    );
    assert(
      dashboardLayout.includes('id="main-content"') && dashboardLayout.includes('role="main"'),
      'Semantic HTML',
      'Main app landmark container tagged with id="main-content" and role="main"'
    );

    // 11. PublicLayout Skip Link
    const publicLayout = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/PublicLayout.tsx'), 'utf-8');
    assert(
      publicLayout.includes('Skip to main content') && publicLayout.includes('href="#public-main-content"'),
      'Bypass Blocks',
      'PublicLayout implements keyboard Skip-to-main-content link'
    );

    // -------------------------------------------------------------
    // TEST SUITE 4: Accessible Dialogs & Modals (SC 2.1.1, 2.1.2, 4.1.2)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Accessible Dialogs & Drawers ---');

    // 12. Modal.tsx ARIA attributes & Focus Trap
    const modalTsx = fs.readFileSync(path.join(frontendRoot, 'src/components/common/Modal.tsx'), 'utf-8');
    assert(modalTsx.includes('role="dialog"'), 'Modal A11y', 'Modal defines role="dialog"');
    assert(modalTsx.includes('aria-modal="true"'), 'Modal A11y', 'Modal defines aria-modal="true"');
    assert(modalTsx.includes('aria-labelledby="modal-title"'), 'Modal A11y', 'Modal defines aria-labelledby linked to title');
    assert(modalTsx.includes("e.key === 'Escape'"), 'Modal A11y', 'Escape key dismisses active modal');
    assert(modalTsx.includes("e.key === 'Tab'"), 'Modal A11y', 'Focus trap cycles focus within active modal');
    assert(modalTsx.includes('previousActiveElement.current?.focus'), 'Modal A11y', 'Focus restored to trigger element on modal close');

    // 13. Drawer.tsx ARIA attributes & Focus Trap
    const drawerTsx = fs.readFileSync(path.join(frontendRoot, 'src/components/common/Drawer.tsx'), 'utf-8');
    assert(drawerTsx.includes('role="dialog"') && drawerTsx.includes('aria-modal="true"'), 'Drawer A11y', 'Drawer defines accessible dialog semantics');
    assert(drawerTsx.includes("e.key === 'Escape'"), 'Drawer A11y', 'Escape key dismisses active drawer');

    // -------------------------------------------------------------
    // TEST SUITE 5: Accessible Forms & Error Validation (SC 3.3.1, 3.3.2)
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Form Inputs & Error Associations ---');

    // 14. Input.tsx accessible associations
    const inputTsx = fs.readFileSync(path.join(frontendRoot, 'src/components/common/Input.tsx'), 'utf-8');
    assert(inputTsx.includes('htmlFor={inputId}'), 'Form A11y', 'Label explicitly associated with input ID');
    assert(inputTsx.includes('aria-invalid={Boolean(error)}'), 'Form A11y', 'aria-invalid reflects input error state');
    assert(inputTsx.includes('aria-describedby={describedBy}'), 'Form A11y', 'aria-describedby links input to error message or helper');
    assert(inputTsx.includes('role="alert"'), 'Form A11y', 'Error message container announced with role="alert"');

    // 15. Select.tsx accessible associations
    const selectTsx = fs.readFileSync(path.join(frontendRoot, 'src/components/common/Select.tsx'), 'utf-8');
    assert(selectTsx.includes('htmlFor={selectId}'), 'Select A11y', 'Select dropdown label explicitly associated via htmlFor');
    assert(selectTsx.includes('aria-invalid={Boolean(error)}'), 'Select A11y', 'Select aria-invalid reflects error status');

    // 16. Button.tsx accessible states
    const buttonTsx = fs.readFileSync(path.join(frontendRoot, 'src/components/common/Button.tsx'), 'utf-8');
    assert(buttonTsx.includes('aria-busy={isLoading}'), 'Button A11y', 'Loading button marked with aria-busy');
    assert(buttonTsx.includes('aria-disabled={disabled || isLoading}'), 'Button A11y', 'Disabled button marked with aria-disabled');
    assert(buttonTsx.includes('<span className="sr-only">Loading...</span>'), 'Button A11y', 'Screen reader loading status announcement present');

    // -------------------------------------------------------------
    // TEST SUITE 6: Accessible Tables & Keyboard Row Navigation
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Accessible Tables & Keyboard Navigation ---');

    // 17. Common Table.tsx
    const tableTsx = fs.readFileSync(path.join(frontendRoot, 'src/components/common/Table.tsx'), 'utf-8');
    assert(tableTsx.includes('scope="col"'), 'Table A11y', 'Table header cells tagged with scope="col"');
    assert(tableTsx.includes('aria-label={ariaLabel}'), 'Table A11y', 'Table has accessible label name');
    assert(tableTsx.includes("e.key === 'Enter' || e.key === ' '"), 'Table A11y', 'Clickable rows support keyboard activation (Enter / Space)');

    // 18. CustomersPage Table
    const customersPage = fs.readFileSync(path.join(frontendRoot, 'src/pages/CustomersPage.tsx'), 'utf-8');
    assert(customersPage.includes('scope="col"'), 'Table A11y', 'Customers table header cells use scope="col"');
    assert(customersPage.includes('aria-label="Customers directory"'), 'Table A11y', 'Customers table has aria-label');

    // 19. JobsQueuePage Table
    const jobsPage = fs.readFileSync(path.join(frontendRoot, 'src/pages/JobsQueuePage.tsx'), 'utf-8');
    assert(jobsPage.includes('scope="col"'), 'Table A11y', 'Jobs queue table header cells use scope="col"');
    assert(jobsPage.includes('aria-label="Jobs work queue"'), 'Table A11y', 'Jobs queue table has aria-label');

    // -------------------------------------------------------------
    // TEST SUITE 7: Responsive Mobile Drawer & Layout Breakpoints
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: Responsive Mobile Drawer & Breakpoints ---');

    // 20. Sidebar mobile drawer overlay & translation
    const sidebarTsx = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/Sidebar.tsx'), 'utf-8');
    assert(
      sidebarTsx.includes('md:hidden') && sidebarTsx.includes('setSidebarOpen(false)'),
      'Mobile Drawer',
      'Mobile drawer backdrop overlay closes sidebar on tap'
    );
    assert(
      sidebarTsx.includes('-translate-x-full md:translate-x-0'),
      'Mobile Navigation',
      'Sidebar translates off-canvas on mobile screens when closed'
    );
    assert(
      sidebarTsx.includes('window.innerWidth < 768'),
      'Mobile Navigation',
      'Navigation link clicks auto-close mobile drawer on small screens'
    );

    // 21. Header mobile responsive adjustments
    const headerTsx = fs.readFileSync(path.join(frontendRoot, 'src/components/layout/Header.tsx'), 'utf-8');
    assert(headerTsx.includes("e.key === 'Escape'"), 'Dropdown A11y', 'Header profile & notification dropdowns dismiss on Escape key');
    assert(headerTsx.includes('role="menu"'), 'Dropdown A11y', 'Profile dropdown container tagged with role="menu"');

    // -------------------------------------------------------------
    // TEST SUITE 8: Cross-Browser Print Compatibility Engine
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 8: Cross-Browser Print Compatibility ---');

    // 22. Print Media Rules in index.css
    assert(indexCss.includes('@media print'), 'Print Engine', '@media print query declared');
    assert(indexCss.includes('size: A4 portrait;'), 'Print Engine', 'Target print page format configured as A4 portrait (210mm x 297mm)');
    assert(
      indexCss.includes('-webkit-print-color-adjust: exact') && indexCss.includes('print-color-adjust: exact'),
      'Print Engine',
      'Both WebKit (-webkit-print-color-adjust) and standard print-color-adjust declared'
    );
    assert(
      indexCss.includes('header,') && indexCss.includes('aside,') && indexCss.includes('.print-hide'),
      'Print Engine',
      'UI navigation chrome hidden during print operations'
    );
    assert(
      indexCss.includes('page-break-inside: avoid') || indexCss.includes('break-inside: avoid'),
      'Print Engine',
      'Page-break inside avoid protection declared for multi-page documents'
    );

    // 23. Studio Direct Print integration in CvStudioPage
    const cvStudioTsx = fs.readFileSync(path.join(frontendRoot, 'src/pages/CvStudioPage.tsx'), 'utf-8');
    assert(cvStudioTsx.includes('window.print()'), 'Print Engine', 'Direct browser print trigger integrated');
    assert(cvStudioTsx.includes('print:hidden'), 'Print Engine', 'Editor forms and toolbars marked with print:hidden');
    assert(cvStudioTsx.includes('a4-print-sheet'), 'Print Engine', 'CV sheet container marked with A4 print sheet class');

  } catch (err: any) {
    console.error('Fatal testing error:', err.message);
    results.push({
      suite: 'Fatal Runtime Error',
      test: 'Execution Uncaught Exception',
      passed: false,
      error: err.message,
    });
  }

  // Summary
  console.log('\n======================================================');
  console.log('              A11Y & RESPONSIVE SUMMARY               ');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Checks Executed : ${results.length}`);
  console.log(`Passed               : ${passedCount}`);
  console.log(`Failed               : ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nFailed Checks:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - [${r.suite}] ${r.test}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PHASE 24 ACCESSIBILITY, RESPONSIVE & PRINT QUALITY CHECKS PASSED!\n');
    process.exit(0);
  }
}

runPhase24A11yResponsiveTests();
