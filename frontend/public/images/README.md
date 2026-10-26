# RentGoer Property Photography Fallback Assets

This directory contains locally hosted, royalty-free representative property photographs used across the RentGoer marketplace.

## Fallback Assets

| File Name | Scene Description | Ideal Aspect Ratio | Deterministic Category |
| :--- | :--- | :---: | :--- |
| `fallback-apartment.jpg` | Modern multi-story apartment exterior with wood balconies and landscaping | 4:3 | Multi-unit Apartments / Exterior |
| `fallback-living.jpg` | Bright, airy living room with natural light, neutral sofa, and oak flooring | 4:3 | Living Space / Lounge |
| `fallback-bedroom.jpg` | Peaceful modern bedroom with clean linens and warm ambient lighting | 4:3 | Bedroom / Suite |
| `fallback-kitchen.jpg` | Open-concept kitchen with quartz island countertop and brass fixtures | 4:3 | Kitchen & Dining Area |

## Selection & UI Labeling Policy

1. **Upload Priority**: When property owners upload photos via Supabase Storage, the genuine uploaded photos are always displayed first.
2. **Deterministic Rotation**: When a property listing has no uploaded photos, `frontend/src/lib/property-images.ts` hashes the property ID/title to select one of the fallback assets deterministically so neighboring cards in the catalog grid display diverse imagery.
3. **Illustrative Disclosure**: As required by ethical real estate presentation standards, any card or gallery using representative photography renders a visible `Illustrative image` badge to ensure tenants know the image is representative rather than the specific rented unit.
4. **License & Origin**: Bespoke high-resolution imagery generated specifically for RentGoer's forest-green and warm-ivory design system. Royalty-free, hosted locally within the repository under `frontend/public/images/` with zero third-party tracking or CDN dependencies.
