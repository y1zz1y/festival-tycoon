# Referenz: Festivals und fehlende Umgebungskategorien

Abgleich mit `docs/decoration.md` (Themen), `docs/terrain.md` (Cover) und dem Katalog.

## Was schon trägt

| Festival-Typ | Vorhanden |
| --- | --- |
| Woodstock / Folk | Klassik, Acker, Gras |
| Burning Man / Desert | Thema Wüste, Sand, **Salzpfanne**, Playa-Stele |
| Wald-Raves (Boom, Ozora, Fuji Rock) | Thema Wald |
| Rave / EDM (Tomorrowland, EDC) | Neon |
| Warehouse | Industrie |
| Strand / Karibik | Tropen, Sand |
| Alpen / Wacken-Matsch | Alpin, Erde, Acker |
| Arktis / Schnee | Arktis, Schnee |
| Motorsport (RaR, F1-Wochenende) | **Asphalt**, **Streckenbegrenzung** |

## Zentral fehlend (Wiedererkennbarkeit, nicht Kleinkram)

| Kategorie | Warum | Festivals |
| --- | --- | --- |
| Rennstrecke / Asphalt-Oval | Silhouette, nicht nur Wiese | Rock am Ring, F1-Support, Sonoma |
| Salz- / Wüstenpfanne | Playa ist nicht Dünensand | Burning Man, AfrikaBurn |
| Streckenmarkierung / Kerbs | Rot-weiß macht Piste lesbar | Nürburgring, Street Circuits |
| Staumauer / Talsperre | Harte Kante + Wasser | manche Alpen- und Stausee-Open-Airs |
| Arena-Oval / Amphitheater | Eingesenkte Schüssel | antike/steinige Freilichtbühnen |
| Hafen / Kai | Kante, Poller, Wasser | Hafenfestivals, Notting-Hill-nah nur urban |
| Reisfelder / Terrassen | Wasser + Stufen | Fuji Rock / japanische Berglagen |
| Sakura / Waldlichtung | Blütenhain statt generischem Wald | Fuji Rock, japanische Parks |
| Karnevalszug-Gasse | Breite Prachtstraße | Carnival, Notting Hill |
| Damm / Deich | Linearer Wall zum Wasser | niederländische / Küstenfestivals |

Nicht umsetzen ohne Auftrag: Laternen-Varianten, einzelne F1-Schilder, 50 Props.

## Bild → Gelände (Nutzer-Upload)

1. Bounding-Box oder „Norden = Eingang (−Z)“ festlegen.
2. Flächenfarben: hellgrau/weiß → `salt`, dunkelgrau → `asphalt`, grün → `grass`,
   beige → `sand`, braun → `earth`/`field`, blau → Wasserhöhe −1.
3. Linien (Straßen, Strecke) als Polylinie Breite 1–2 Felder rasterisieren.
4. Höhen nur wenn eine Heightmap da ist; sonst flach oder leichte Skizzenhügel.
5. Als `public/scenarios/*.json` schreiben, `npm run validate`.
