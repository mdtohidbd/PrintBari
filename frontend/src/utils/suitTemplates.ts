/**
 * High-Resolution Vector Suit Templates for Passport Photo Studio
 * Inspired by professional digital studio workflows (Studiozly).
 * These SVG templates overlay onto customer portraits to convert
 * casual shirts/t-shirts into formal passport-compliant suits.
 */

export interface SuitTemplate {
  id: string;
  name: string;
  nameBn: string;
  category: 'men' | 'women';
  svg: string;
}

export const SUIT_TEMPLATES: SuitTemplate[] = [
  {
    id: 'none',
    name: 'Original Attire (No Suit)',
    nameBn: 'আসল পোশাক (স্যুট ছাড়া)',
    category: 'men',
    svg: '',
  },
  {
    id: 'mens_black_suit',
    name: 'Executive Black Suit & Red Tie',
    nameBn: 'কালো স্যুট ও লাল টাই',
    category: 'men',
    svg: `<svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="blackCoat" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2D3748" />
          <stop offset="40%" stop-color="#1A202C" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
        <linearGradient id="lapelShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#111827" />
          <stop offset="100%" stop-color="#374151" />
        </linearGradient>
        <linearGradient id="redTie" x1="0" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#E11D48" />
          <stop offset="50%" stop-color="#BE123C" />
          <stop offset="100%" stop-color="#881337" />
        </linearGradient>
      </defs>
      <!-- Base Torso / Jacket Back -->
      <path d="M 50 400 C 50 200 130 110 210 100 L 290 100 C 370 110 450 200 450 400 Z" fill="url(#blackCoat)" />
      
      <!-- White Shirt Collar & Chest Triangle -->
      <polygon points="210,100 250,220 290,100" fill="#FFFFFF" />
      <polygon points="195,95 240,150 220,155" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />
      <polygon points="305,95 260,150 280,155" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" />
      
      <!-- Red Necktie -->
      <!-- Knot -->
      <polygon points="238,125 262,125 258,155 242,155" fill="#E11D48" stroke="#9F1239" stroke-width="1" />
      <!-- Tie Body -->
      <polygon points="242,155 258,155 266,320 250,350 234,320" fill="url(#redTie)" stroke="#881337" stroke-width="1.5" />
      
      <!-- Left Lapel -->
      <path d="M 210 100 L 150 210 L 220 240 L 245 350 L 220 400 L 120 400 C 90 280 130 160 210 100 Z" fill="url(#lapelShade)" stroke="#1F2937" stroke-width="1.5" />
      
      <!-- Right Lapel -->
      <path d="M 290 100 L 350 210 L 280 240 L 255 350 L 280 400 L 380 400 C 410 280 370 160 290 100 Z" fill="url(#lapelShade)" stroke="#1F2937" stroke-width="1.5" />
      
      <!-- Button Accent -->
      <circle cx="250" cy="370" r="7" fill="#1E293B" stroke="#475569" stroke-width="1.5" />
    </svg>`,
  },
  {
    id: 'mens_navy_suit',
    name: 'Corporate Navy Blazer & Blue Tie',
    nameBn: 'নেভি ব্লু ব্লেজার ও টাই',
    category: 'men',
    svg: `<svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="navyCoat" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1E3A8A" />
          <stop offset="50%" stop-color="#1E293B" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
        <linearGradient id="navyLapel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#172554" />
          <stop offset="100%" stop-color="#1E40AF" />
        </linearGradient>
        <linearGradient id="blueStripedTie" x1="0" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0284C7" />
          <stop offset="50%" stop-color="#0369A1" />
          <stop offset="100%" stop-color="#075985" />
        </linearGradient>
      </defs>
      <!-- Base Torso -->
      <path d="M 50 400 C 50 200 130 110 210 100 L 290 100 C 370 110 450 200 450 400 Z" fill="url(#navyCoat)" />
      
      <!-- White Shirt Collar -->
      <polygon points="210,100 250,220 290,100" fill="#FFFFFF" />
      <polygon points="195,95 240,150 220,155" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5" />
      <polygon points="305,95 260,150 280,155" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5" />
      
      <!-- Tie -->
      <polygon points="238,125 262,125 258,155 242,155" fill="#0284C7" />
      <polygon points="242,155 258,155 266,320 250,350 234,320" fill="url(#blueStripedTie)" stroke="#0369A1" stroke-width="1.5" />
      
      <!-- Lapels -->
      <path d="M 210 100 L 150 210 L 220 240 L 245 350 L 220 400 L 120 400 C 90 280 130 160 210 100 Z" fill="url(#navyLapel)" stroke="#1E3A8A" stroke-width="1.5" />
      <path d="M 290 100 L 350 210 L 280 240 L 255 350 L 280 400 L 380 400 C 410 280 370 160 290 100 Z" fill="url(#navyLapel)" stroke="#1E3A8A" stroke-width="1.5" />
      <circle cx="250" cy="370" r="7" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.5" />
    </svg>`,
  },
  {
    id: 'mens_charcoal_suit',
    name: 'Formal Charcoal Coat & Black Tie',
    nameBn: 'চারকোল গ্রে কোট ও কালো টাই',
    category: 'men',
    svg: `<svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="charcoalCoat" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4B5563" />
          <stop offset="50%" stop-color="#374151" />
          <stop offset="100%" stop-color="#1F2937" />
        </linearGradient>
      </defs>
      <path d="M 50 400 C 50 200 130 110 210 100 L 290 100 C 370 110 450 200 450 400 Z" fill="url(#charcoalCoat)" />
      
      <!-- Light Blue Shirt -->
      <polygon points="210,100 250,220 290,100" fill="#E0F2FE" />
      <polygon points="195,95 240,150 220,155" fill="#BAE6FD" stroke="#7DD3FC" stroke-width="1.5" />
      <polygon points="305,95 260,150 280,155" fill="#BAE6FD" stroke="#7DD3FC" stroke-width="1.5" />
      
      <!-- Black Silk Tie -->
      <polygon points="238,125 262,125 258,155 242,155" fill="#111827" />
      <polygon points="242,155 258,155 266,320 250,350 234,320" fill="#18181B" stroke="#09090B" stroke-width="1.5" />
      
      <!-- Lapels -->
      <path d="M 210 100 L 150 210 L 220 240 L 245 350 L 220 400 L 120 400 C 90 280 130 160 210 100 Z" fill="#374151" stroke="#1F2937" stroke-width="1.5" />
      <path d="M 290 100 L 350 210 L 280 240 L 255 350 L 280 400 L 380 400 C 410 280 370 160 290 100 Z" fill="#374151" stroke="#1F2937" stroke-width="1.5" />
      <circle cx="250" cy="370" r="7" fill="#111827" stroke="#4B5563" stroke-width="1.5" />
    </svg>`,
  },
  {
    id: 'womens_black_blazer',
    name: "Women's Professional Blazer",
    nameBn: 'মহিলাদের ফরমাল ব্লেজার',
    category: 'women',
    svg: `<svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="womenBlazer" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="50%" stop-color="#1E293B" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
      </defs>
      <!-- Base Torso -->
      <path d="M 50 400 C 50 210 135 115 210 105 L 290 105 C 365 115 450 210 450 400 Z" fill="url(#womenBlazer)" />
      
      <!-- Elegant White Blouse V-Neck -->
      <polygon points="210,105 250,250 290,105" fill="#FFFFFF" />
      <path d="M 215 105 Q 250 160 250 230 Q 250 160 285 105 Z" fill="#F8FAFC" />
      
      <!-- Lapels (Narrower feminine cut) -->
      <path d="M 210 105 L 160 200 L 225 240 L 250 340 L 220 400 L 120 400 C 90 280 130 160 210 105 Z" fill="#1E293B" stroke="#0F172A" stroke-width="1.5" />
      <path d="M 290 105 L 340 200 L 275 240 L 250 340 L 280 400 L 380 400 C 410 280 370 160 290 105 Z" fill="#1E293B" stroke="#0F172A" stroke-width="1.5" />
      <circle cx="250" cy="355" r="6" fill="#F1F5F9" stroke="#94A3B8" stroke-width="1" />
    </svg>`,
  },
];

