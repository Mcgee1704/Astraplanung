# Astraplanung

Astraplanung ist eine deutschsprachige Browseranwendung für den Ausbau von Kastenwagen und Expeditionskoffern. Aus demselben Projekt entstehen Grundriss, Versorgungsrechnung, Werkstattmappe und Fahrzeugakte.

## Öffnen

[Astraplanung als einzelne HTML-Datei herunterladen](https://github.com/Mcgee1704/Astraplanung/releases/latest/download/Astraplanung.html) und die gespeicherte Datei im Browser öffnen. Sie enthält die Anwendung, Schriften und Bilder und funktioniert ohne Internet oder Server. Wer selbst baut, findet dieselbe Datei unter `dist/Astraplanung.html`.

Fahrzeugprojekte werden im verwendeten Browser gespeichert. Unter **Projektdatei → Exportieren** entsteht eine übertragbare JSON-Sicherung für ein anderes Gerät. **Fahrzeugakte → Offline-Datei** erzeugt eine separat lesbare Werkstattübergabe einschließlich der Fotos und Gerätekennungen, die du im Projekt hinterlegt hast.

## Arbeiten am Fahrzeug

1. Basisfahrzeug, Innenmaße, Reisende und Standtage eintragen. Gemessene Achslasten mit dem Wiegezustand dokumentieren.
2. Ein ausgestattetes Planungsbeispiel, einen Tourengrundriss oder eine leere Kabine öffnen. Einbauten in 2D verschieben und ihre Höhe, Wartungsöffnung und Lage in 3D prüfen.
3. Stromquellen, Batterien, Verbraucher, Wärmebedarf und Wasservorräte abstimmen. Der Variantenvergleich untersucht den 100-/150-Liter-Tank und alternative Basisfahrzeuge. Im Reiseprofil lassen sich Etappen mit Nachversorgung planen.
4. In der Werkstatt Zuschnitte, Einzelmaße, Einkäufe, Leitungswege und Prüfschritte bearbeiten und ausgeben. Einbaumaße, Gerätekennungen, Trennstellen, Ersatzteile und Wartung im tatsächlichen Baustand dokumentieren.

Die drei ausgestatteten Beispiele und 18 Tourengrundrisse lassen sich an das eigene Fahrzeug anpassen. Unter **Planungsgrundlagen** kannst du die Innenmaße ansehen und einen Entwurf als neues Projekt öffnen. Höhen, Preise, Massen und Geräteleistungen sind Planansätze, bis ein Aufmaß, eine Wägung oder ein Datenblatt vorliegt. Der 3D-Editor rechnet mit Bauteilhüllen. Für die Montage zählen auch Wandkontur, Befestigung und Anschlussraum.

## Entwicklung

Voraussetzungen sind Node.js ab 22.12 und pnpm.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

`dist/index.html` eignet sich für statisches Hosting. Unter HTTPS oder auf localhost speichert ein Service Worker die Anwendung nach dem ersten Aufruf für die Offline-Nutzung. Die Ein-Datei-Ausgabe lässt sich direkt vom Datenträger öffnen.
