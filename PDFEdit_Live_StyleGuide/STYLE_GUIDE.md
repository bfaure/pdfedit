# PDFEdit.live Brand Style Guide

## Brand Overview
PDFEdit.live is a modern, live PDF editing web application. The brand identity emphasizes efficiency, clarity, and real-time collaboration through clean design and vibrant accents.

---

## Color Palette

### Primary Colors

**Electric Blue** (Brand Accent)
- Hex: `#02B7FF`
- RGB: `2, 183, 255`
- HSL: `197, 100%, 50%`
- Usage: Primary CTAs, links, active states, ".live" branding element, focus indicators

**Navy Blue** (Primary Dark)
- Hex: `#1A2237`
- RGB: `26, 34, 55`
- HSL: `223, 36%, 16%`
- Usage: Primary text, headings, main logo text, dark backgrounds

### Secondary Colors

**Light Blue** (Hover/Secondary)
- Hex: `#33C4FF`
- RGB: `51, 196, 255`
- HSL: `197, 100%, 60%`
- Usage: Hover states, secondary buttons, info messages

**Deep Blue** (Accent Dark)
- Hex: `#0195D4`
- RGB: `1, 149, 212`
- HSL: `198, 99%, 42%`
- Usage: Active states, pressed buttons, selected items

### Neutral Palette

**White**
- Hex: `#FFFFFF`
- Usage: Backgrounds (light mode), text on dark backgrounds

**Light Gray** (Background)
- Hex: `#F5F7FA`
- RGB: `245, 247, 250`
- Usage: Secondary backgrounds, card backgrounds, subtle dividers

**Medium Gray** (Borders)
- Hex: `#E1E8ED`
- RGB: `225, 232, 237`
- Usage: Borders, dividers, inactive states

**Text Gray** (Secondary Text)
- Hex: `#8899A8`
- RGB: `136, 153, 168`
- Usage: Secondary text, placeholders, disabled text

**Dark Gray** (Dark Mode Background)
- Hex: `#2A3142`
- RGB: `42, 49, 66`
- Usage: Dark mode backgrounds, cards in dark mode

### Semantic Colors

**Success Green**
- Hex: `#10B981`
- RGB: `16, 185, 129`
- Usage: Success messages, confirmation states, positive actions

**Warning Orange**
- Hex: `#F59E0B`
- RGB: `245, 158, 11`
- Usage: Warning messages, caution states

**Error Red**
- Hex: `#EF4444`
- RGB: `239, 68, 68`
- Usage: Error messages, destructive actions, validation errors

**Info Blue**
- Hex: `#3B82F6`
- RGB: `59, 130, 246`
- Usage: Informational messages, tips, neutral notifications

---

## Typography

### Font Families

**Primary Font: Inter**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
```
- Usage: UI elements, body text, buttons, forms
- Fallback: System UI fonts
- Weights: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)

**Alternative: Roboto**
```css
font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```
- Usage: Alternative if Inter is unavailable
- Weights: 400, 500, 700

**Monospace: JetBrains Mono**
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
```
- Usage: Code blocks, file names, technical data
- Weight: 400, 500

### Type Scale

**Display Heading** (Hero sections)
- Size: `48px / 3rem`
- Weight: `700 (Bold)`
- Line height: `1.2`
- Letter spacing: `-0.02em`

**H1** (Page titles)
- Size: `36px / 2.25rem`
- Weight: `700 (Bold)`
- Line height: `1.3`
- Letter spacing: `-0.01em`

**H2** (Section headings)
- Size: `30px / 1.875rem`
- Weight: `600 (Semi-bold)`
- Line height: `1.4`

**H3** (Subsection headings)
- Size: `24px / 1.5rem`
- Weight: `600 (Semi-bold)`
- Line height: `1.4`

**H4** (Card headings)
- Size: `20px / 1.25rem`
- Weight: `600 (Semi-bold)`
- Line height: `1.5`

**Body Large**
- Size: `18px / 1.125rem`
- Weight: `400 (Regular)`
- Line height: `1.6`

**Body** (Default text)
- Size: `16px / 1rem`
- Weight: `400 (Regular)`
- Line height: `1.6`

**Body Small**
- Size: `14px / 0.875rem`
- Weight: `400 (Regular)`
- Line height: `1.5`

**Caption**
- Size: `12px / 0.75rem`
- Weight: `400 (Regular)`
- Line height: `1.4`

**Button Text**
- Size: `16px / 1rem`
- Weight: `500 (Medium)`
- Letter spacing: `0.01em`

---

## Logo Usage

### Logo Variations
- **Horizontal:** Use for wide spaces (headers, footers, landing pages)
- **Vertical:** Use for square/narrow spaces (mobile, app icons, favicons)
- **Dark version:** Use on dark backgrounds (#1A2237 or darker)
- **Transparent version:** Use on light backgrounds

### Clear Space
Maintain minimum clear space equal to the height of the icon element around the logo.

### Minimum Size
- Horizontal: 180px width minimum
- Vertical: 100px width minimum

### Don'ts
- Do not distort or stretch the logo
- Do not change the logo colors
- Do not add effects (shadows, gradients, outlines)
- Do not place on busy backgrounds without proper contrast

---

## UI Component Guidelines

### Buttons

**Primary Button**
- Background: `#02B7FF`
- Text: `#FFFFFF`
- Hover: `#33C4FF`
- Active: `#0195D4`
- Border radius: `8px`
- Padding: `12px 24px`

**Secondary Button**
- Background: `transparent`
- Border: `2px solid #1A2237`
- Text: `#1A2237`
- Hover: Background `#F5F7FA`
- Border radius: `8px`
- Padding: `12px 24px`

**Ghost Button**
- Background: `transparent`
- Text: `#02B7FF`
- Hover: Background `rgba(2, 183, 255, 0.1)`
- Border radius: `8px`
- Padding: `12px 24px`

### Form Elements
- Border radius: `6px`
- Border: `1px solid #E1E8ED`
- Focus border: `2px solid #02B7FF`
- Padding: `10px 14px`
- Background: `#FFFFFF`

### Cards
- Background: `#FFFFFF`
- Border: `1px solid #E1E8ED` (optional)
- Border radius: `12px`
- Shadow: `0 2px 8px rgba(26, 34, 55, 0.08)`

### Spacing System
Use 8px base unit:
- 4px (0.25rem) - Extra small
- 8px (0.5rem) - Small
- 16px (1rem) - Medium
- 24px (1.5rem) - Large
- 32px (2rem) - Extra large
- 48px (3rem) - XXL
- 64px (4rem) - XXXL

---

## Dark Mode

### Dark Mode Colors

**Backgrounds**
- Primary: `#1A2237`
- Secondary: `#2A3142`
- Elevated: `#353D52`

**Text**
- Primary: `#FFFFFF`
- Secondary: `#B8C5D6`
- Disabled: `#6B7885`

**Accent**
- Primary: `#02B7FF` (same as light mode)
- Hover: `#33C4FF`

**Borders**
- Default: `#3A4459`
- Elevated: `#4A5468`

---

## Accessibility Guidelines

### Color Contrast
- Ensure minimum WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)
- Primary blue (#02B7FF) on white passes AA for large text
- Navy (#1A2237) on white passes AAA for all text sizes

### Focus States
- Use 2px solid `#02B7FF` outline with 2px offset
- Ensure keyboard navigation is clearly visible

### Typography
- Minimum body text size: 16px
- Line height minimum: 1.5 for body text
- Maximum line length: 75 characters for readability

---

## Implementation Quick Reference

### CSS Variables
```css
:root {
  /* Primary Colors */
  --color-primary: #02B7FF;
  --color-primary-dark: #0195D4;
  --color-primary-light: #33C4FF;
  --color-navy: #1A2237;

  /* Neutral Colors */
  --color-white: #FFFFFF;
  --color-gray-50: #F5F7FA;
  --color-gray-200: #E1E8ED;
  --color-gray-500: #8899A8;
  --color-gray-700: #2A3142;

  /* Semantic Colors */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Typography */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Consolas', monospace;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(26, 34, 55, 0.06);
  --shadow-md: 0 2px 8px rgba(26, 34, 55, 0.08);
  --shadow-lg: 0 8px 16px rgba(26, 34, 55, 0.12);
}
```

### Tailwind Config (if applicable)
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#02B7FF',
          dark: '#0195D4',
          light: '#33C4FF',
        },
        navy: '#1A2237',
        // ... add other colors
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
}
```

---

## Brand Voice & Messaging

**Tone:** Professional, efficient, modern, approachable

**Key Messages:**
- Live, real-time PDF editing
- Fast and intuitive
- Collaborative and seamless

**Example UI Copy:**
- "Edit PDFs in real-time"
- "Your changes, instantly saved"
- "Collaborate seamlessly"

---

This style guide is a living document. Update as the brand evolves.
