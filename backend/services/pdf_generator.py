"""
PDF-Generator für offizielle Sturmnachweis-Dokumente.
Nutzt ReportLab für Layout und Matplotlib für Diagramme.
"""
import io
import logging
from datetime import date, datetime
from pathlib import Path

import re
import base64
from xml.sax.saxutils import escape as xml_escape
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas as rl_canvas

from models.schemas import QueryResponse, StormEvent
from config import settings

logger = logging.getLogger(__name__)

LOGO_PATH = Path(__file__).parent.parent / "assets" / "logo.svg"


def _escape_markup(value: object) -> str:
    """Escapes dynamic text before it is inserted into ReportLab Paragraph markup."""
    return xml_escape("" if value is None else str(value), {'"': "&quot;", "'": "&apos;"})


def _logo_image(width_cm: float, max_height_cm: float = 3.0) -> Image | None:
    """
    Lädt das Logo für den PDF-Report.
    Berechnet die Höhe automatisch aus dem echten Seitenverhältnis des Logos —
    kein manuelles height_cm mehr, das zu Verzerrungen führen würde.
    max_height_cm begrenzt die Höhe nach oben (Standardwert 3.0 cm).
    """
    try:
        import numpy as np
        svg_text = LOGO_PATH.read_text(encoding="utf-8", errors="ignore")
        m = re.search(r'data:image/png;base64,([A-Za-z0-9+/=\s]+)', svg_text)
        if not m:
            raise ValueError("Kein PNG-Embed im SVG gefunden")

        raw_png = base64.b64decode(m.group(1).replace("\n", "").strip())
        src = PILImage.open(io.BytesIO(raw_png)).convert("RGB")
        arr = np.array(src, dtype=np.float32)

        # Luminanz bestimmt die Logo-Silhouette
        luminance = (0.2126 * arr[:, :, 0]
                     + 0.7152 * arr[:, :, 1]
                     + 0.0722 * arr[:, :, 2])

        # Normalisieren (min→0, max→255) + Gamma-Boost für Sichtbarkeit
        lum_min, lum_max = float(luminance.min()), float(luminance.max())
        normalized = (luminance - lum_min) / max(lum_max - lum_min, 1.0) * 255.0
        gamma = 0.4  # < 1: hebt Mitteltöne an → Logo wirkt dunkler/klarer
        alpha = np.clip((normalized / 255.0) ** gamma * 255.0, 0, 255).astype(np.uint8)

        # Dunkelblau (#1a3a5c) als Logofarbe auf weißem Hintergrund
        result = np.ones((arr.shape[0], arr.shape[1], 4), dtype=np.uint8) * 255
        result[:, :, 0] = 26   # #1a3a5c R
        result[:, :, 1] = 58   # G
        result[:, :, 2] = 92   # B
        result[:, :, 3] = alpha  # hell im Original = opak dunkelblau im PDF

        logo_layer = PILImage.fromarray(result, "RGBA")
        white_bg = PILImage.new("RGBA", logo_layer.size, (255, 255, 255, 255))
        composite = PILImage.alpha_composite(white_bg, logo_layer)
        rgb_img = composite.convert("RGB")

        # Echtes Seitenverhältnis des Logos berechnen
        actual_aspect = src.height / src.width  # z.B. 0.616 für 1097x676 px
        actual_height_cm = width_cm * actual_aspect

        # Breite ggf. reduzieren damit max_height_cm nicht überschritten wird
        if actual_height_cm > max_height_cm:
            actual_height_cm = max_height_cm
            effective_width_cm = actual_height_cm / actual_aspect
        else:
            effective_width_cm = width_cm

        # Zielgröße (150 dpi)
        target_w = int(effective_width_cm * 150 / 2.54)
        target_h = int(actual_height_cm * 150 / 2.54)
        rgb_img = rgb_img.resize((target_w, target_h), PILImage.LANCZOS)

        out = io.BytesIO()
        rgb_img.save(out, format="PNG")
        out.seek(0)
        logger.info("Logo extrahiert (%dx%d px, %.2fcm x %.2fcm)",
                    target_w, target_h, effective_width_cm, actual_height_cm)
        return Image(out, width=effective_width_cm * cm, height=actual_height_cm * cm)

    except Exception as e:
        logger.warning("Logo (Luminanz/PIL) fehlgeschlagen: %s", e)
        return None


# Farben (Blau/Grau für professionelles Erscheinungsbild)
COLOR_PRIMARY   = colors.HexColor("#1a3a5c")  # Dunkelblau
COLOR_SECONDARY = colors.HexColor("#2e6da4")  # Mittelblau
COLOR_ACCENT    = colors.HexColor("#d9534f")  # Rot für Warnwert
COLOR_LIGHT     = colors.HexColor("#f0f4f8")  # Hellgrau-Blau
COLOR_BORDER    = colors.HexColor("#ccd6e0")
COLOR_TEXT      = colors.HexColor("#1a1a2e")
COLOR_MUTED     = colors.HexColor("#6c757d")

BFT_COLORS = {8: "#f0ad4e", 9: "#d9534f", 10: "#a94442", 11: "#7b0000", 12: "#4a0000"}


def _beaufort_color(bft: int) -> str:
    return BFT_COLORS.get(bft, "#5bc0de")


def _generate_chart(storm_days: list[StormEvent], damage_date: date | None) -> bytes:
    """Erstellt ein Balkendiagramm der Sturmtage als PNG-Bytes."""
    if not storm_days:
        fig, ax = plt.subplots(figsize=(12, 3))
        ax.text(0.5, 0.5, "Keine Sturmtage im Auswertungszeitraum",
                ha="center", va="center", transform=ax.transAxes,
                fontsize=14, color="#888888")
        ax.axis("off")
    else:
        # Sortiere aufsteigend für Zeitreihe
        sorted_days = sorted(storm_days, key=lambda e: e.date)
        dates = [e.date for e in sorted_days]
        gusts = [e.max_gust_kmh for e in sorted_days]
        bft_vals = [e.beaufort for e in sorted_days]
        bar_colors = [_beaufort_color(b) for b in bft_vals]

        fig, ax = plt.subplots(figsize=(12, 4))
        bars = ax.bar(dates, gusts, color=bar_colors, alpha=0.85, width=0.6, zorder=3)

        # Schwellwertlinie
        ax.axhline(y=62, color="#d9534f", linewidth=1.5, linestyle="--",
                   label="Bft 8 (62 km/h)", zorder=4)
        ax.axhline(y=75, color="#a94442", linewidth=1.0, linestyle=":",
                   label="Bft 9 (75 km/h)", alpha=0.7, zorder=4)

        # Schadensdatum markieren
        if damage_date and min(dates) <= damage_date <= max(dates):
            ax.axvline(x=damage_date, color="#1a3a5c", linewidth=2.0,
                       linestyle="-.", label=f"Schadensdatum", zorder=5)

        ax.set_ylabel("Max. Böe (km/h)", fontsize=10)
        ax.set_xlabel("Datum", fontsize=10)
        ax.set_ylim(50, max(max(gusts) * 1.1, 90))
        ax.grid(axis="y", alpha=0.3, zorder=0)
        ax.set_facecolor("#fafbfc")
        fig.patch.set_facecolor("white")

        # X-Achse formatieren
        if len(dates) > 1:
            ax.xaxis.set_major_formatter(mdates.DateFormatter("%d.%m.%Y"))
            fig.autofmt_xdate(rotation=30, ha="right")

        # Legende
        ax.legend(fontsize=9, loc="upper left", framealpha=0.9)

        # Beaufort-Wert auf Balken
        for bar, bft in zip(bars, bft_vals):
            if bft >= 8:
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    bar.get_height() + 0.5,
                    f"Bft {bft}",
                    ha="center", va="bottom", fontsize=7, color="#333",
                    fontweight="bold"
                )

    plt.tight_layout(pad=0.5)
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


class NumberedCanvas(rl_canvas.Canvas):
    """Fügt Seitenzahlen hinzu."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        n = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_number(n)
            super().showPage()
        super().save()

    def _draw_page_number(self, total_pages):
        self.setFont("Helvetica", 8)
        self.setFillColor(COLOR_MUTED)
        self.drawRightString(
            A4[0] - 2*cm, 1.2*cm,
            f"Seite {self._pageNumber} von {total_pages}"
        )


def generate_pdf(
    result: QueryResponse,
    damage_date: date,
    report_date: date | None = None,
    policy_number: str | None = None,
    insured_name: str | None = None,
    insured_address: str | None = None,
    claim_number: str | None = None,
    news_result: dict | None = None,
) -> bytes:
    """
    Erstellt ein professionelles PDF-Dokument als Sturmnachweis.
    Gibt den PDF-Inhalt als Bytes zurück.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=2.5*cm,
        bottomMargin=2.5*cm,
        leftMargin=2.5*cm,
        rightMargin=2.0*cm,
        title="Sturmnachweis",
        author=settings.company_name,
        subject=f"Sturmnachweis für PLZ {result.location.plz}",
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Styles ──────────────────────────────────────────────────────────────
    h1 = ParagraphStyle("h1", parent=styles["Normal"],
        fontSize=18, fontName="Helvetica-Bold",
        textColor=COLOR_PRIMARY, spaceAfter=4, leading=22)
    h2 = ParagraphStyle("h2", parent=styles["Normal"],
        fontSize=12, fontName="Helvetica-Bold",
        textColor=COLOR_SECONDARY, spaceBefore=12, spaceAfter=4)
    normal = ParagraphStyle("norm", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica",
        textColor=COLOR_TEXT, leading=14)
    small = ParagraphStyle("small", parent=styles["Normal"],
        fontSize=8, fontName="Helvetica",
        textColor=COLOR_MUTED, leading=12)
    label = ParagraphStyle("label", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica-Bold",
        textColor=COLOR_PRIMARY)
    disclaimer = ParagraphStyle("disc", parent=styles["Normal"],
        fontSize=7.5, fontName="Helvetica-Oblique",
        textColor=COLOR_MUTED, leading=11)

    report_date = report_date or date.today()

    # ── KOPFZEILE ────────────────────────────────────────────────────────────
    logo = _logo_image(width_cm=5.0, max_height_cm=3.1)
    left_cell = logo if logo is not None else Paragraph(
        f"<b>{_escape_markup(settings.company_name)}</b>",
        ParagraphStyle("comp", fontSize=11, fontName="Helvetica-Bold",
                       textColor=COLOR_PRIMARY))
    header_data = [
        [
            left_cell,
            Paragraph(
                f"<b>STURMNACHWEIS</b><br/>"
                f"<font size='8' color='#6c757d'>Windstärken-Dokumentation für Versicherungszwecke</font>",
                ParagraphStyle("doctitle", fontSize=13, fontName="Helvetica-Bold",
                    textColor=COLOR_PRIMARY, alignment=TA_RIGHT))
        ]
    ]
    header_table = Table(header_data, colWidths=[8*cm, 8.5*cm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 1.5, COLOR_PRIMARY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.4*cm))

    # ── DOKUMENTINFORMATIONEN ────────────────────────────────────────────────
    doc_info = [
        ["Berichtsdatum:", report_date.strftime("%d.%m.%Y"),
         "Schadensdatum:", damage_date.strftime("%d.%m.%Y")],
        ["Versicherungsort:", f"PLZ {result.location.plz} {result.location.ort}",
         "Schadensnummer:", claim_number or "—"],
        ["Versicherungsnehmer:", insured_name or "—",
         "Vertragsnummer:", policy_number or "—"],
        ["Adresse:", insured_address or "—", "", ""],
    ]
    doc_table = Table(doc_info, colWidths=[3.5*cm, 5.5*cm, 3.5*cm, 4.0*cm])
    doc_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), COLOR_TEXT),
        ("TEXTCOLOR", (0, 0), (0, -1), COLOR_PRIMARY),
        ("TEXTCOLOR", (2, 0), (2, -1), COLOR_PRIMARY),
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_LIGHT),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [COLOR_LIGHT, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(doc_table)
    story.append(Spacer(1, 0.5*cm))

    # ── ZUSAMMENFASSUNG SCHADENSDATUM ────────────────────────────────────────
    story.append(Paragraph("Auswertung zum Schadensdatum", h2))

    # Suche nach dem nächsten Ereignis am/um das Schadensdatum
    damage_events = [e for e in result.storm_days
                     if abs((e.date - damage_date).days) <= 1]

    if damage_events:
        best = max(damage_events, key=lambda e: e.max_gust_kmh)
        n_sources = len(best.confirming_sources)
        sources_str = " · ".join(best.confirming_sources) if best.confirming_sources else best.source
        sources_markup = _escape_markup(sources_str)
        multi_src = (
            f" <b>Mehrfachbestätigung durch {n_sources} unabhängige Quellen: {sources_markup}.</b>"
            if n_sources >= 2 else f" Quelle: {sources_markup}."
        )
        status_text = (
            f"✔ Am {best.date.strftime('%d.%m.%Y')} wurde eine maximale Windböe von "
            f"<b>{best.max_gust_kmh:.1f} km/h (Bft {best.beaufort})</b> gemessen. "
            f"Die Versicherungsvoraussetzung (≥ Bft 8 / ≥ 62 km/h) ist erfüllt."
            f"{multi_src}"
        )
        box_color = colors.HexColor("#dff0d8")
        text_color = colors.HexColor("#2d6a2d")
    else:
        status_text = (
            f"✘ Am Schadensdatum ({damage_date.strftime('%d.%m.%Y')}) konnte "
            f"keine Windböe ≥ 62 km/h (Bft 8) nachgewiesen werden. "
            f"Bitte prüfen Sie den erweiterten Auswertungszeitraum unten."
        )
        box_color = colors.HexColor("#f2dede")
        text_color = colors.HexColor("#8a2222")

    summary_data = [[Paragraph(status_text, ParagraphStyle(
        "sum", fontSize=9.5, fontName="Helvetica",
        textColor=text_color, leading=14))]]
    summary_table = Table(summary_data, colWidths=[16.5*cm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), box_color),
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.5*cm))

    # ── DIAGRAMM ─────────────────────────────────────────────────────────────
    story.append(Paragraph("Windböen im Auswertungszeitraum", h2))
    story.append(Paragraph(
        f"Auswertungszeitraum: {result.period_start.strftime('%d.%m.%Y')} – "
        f"{result.period_end.strftime('%d.%m.%Y')} | "
        f"Schwellwert: ≥ {result.threshold_kmh:.0f} km/h (Bft 8) | "
        f"Sturmtage gesamt: {result.total_storm_days}",
        small
    ))
    story.append(Spacer(1, 0.2*cm))

    chart_bytes = _generate_chart(result.storm_days, damage_date)
    chart_img = Image(io.BytesIO(chart_bytes), width=16.5*cm, height=5.5*cm)
    story.append(chart_img)
    story.append(Spacer(1, 0.5*cm))

    # ── STURMTAGE-TABELLE ─────────────────────────────────────────────────────
    story.append(Paragraph("Nachgewiesene Sturmtage (Böe ≥ 62 km/h)", h2))

    if result.storm_days:
        table_data = [[
            Paragraph("<b>Datum</b>", label),
            Paragraph("<b>Max. Böe (km/h)</b>", label),
            Paragraph("<b>Beaufort</b>", label),
            Paragraph("<b>Mittelwind</b>", label),
            Paragraph("<b>Bestätigende Quellen</b>", label),
        ]]

        row_styles = []
        for i, event in enumerate(result.storm_days, 1):
            bft_color = colors.HexColor(_beaufort_color(event.beaufort))
            is_damage_day = abs((event.date - damage_date).days) <= 1
            n_src = len(event.confirming_sources)
            src_list = event.confirming_sources if event.confirming_sources else [event.source]

            if n_src >= 3:
                src_color = "#276749"  # Dunkelgrün
                src_prefix = f"✔✔✔ {n_src} Quellen: "
            elif n_src == 2:
                src_color = "#b45309"  # Amber
                src_prefix = f"✔✔ 2 Quellen: "
            else:
                src_color = "#374151"
                src_prefix = ""

            src_text = src_prefix + " · ".join(src_list)
            row = [
                Paragraph(
                    f"<b>{event.date.strftime('%d.%m.%Y')}</b>" +
                    (" ← Schadensdatum" if is_damage_day else ""),
                    ParagraphStyle("td", fontSize=8.5, fontName="Helvetica",
                        textColor=COLOR_PRIMARY if is_damage_day else COLOR_TEXT)
                ),
                Paragraph(
                    f"<b>{event.max_gust_kmh:.1f}</b><br/>"
                    f"<font size='7' color='#6b7280'>{event.max_gust_ms:.1f} m/s</font>",
                    ParagraphStyle("gust", fontSize=8.5, fontName="Helvetica", leading=11)
                ),
                Paragraph(f"Bft {event.beaufort}", ParagraphStyle(
                    "bft", fontSize=9, fontName="Helvetica-Bold",
                    textColor=colors.white if event.beaufort >= 9 else COLOR_TEXT)),
                Paragraph(f"{event.mean_wind_kmh:.1f} km/h" if event.mean_wind_kmh else "—", normal),
                Paragraph(_escape_markup(src_text), ParagraphStyle(
                    "srcs", fontSize=7.5, fontName="Helvetica-Bold" if n_src >= 2 else "Helvetica",
                    textColor=colors.HexColor(src_color), leading=10)),
            ]
            table_data.append(row)

            row_styles.append(("BACKGROUND", (2, i), (2, i), bft_color))
            if is_damage_day:
                row_styles.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#e8f4fd")))
            elif n_src >= 3:
                row_styles.append(("BACKGROUND", (4, i), (4, i), colors.HexColor("#f0fdf4")))
            elif n_src == 2:
                row_styles.append(("BACKGROUND", (4, i), (4, i), colors.HexColor("#fffbeb")))

        events_table = Table(
            table_data,
            colWidths=[3.2*cm, 2.8*cm, 2.2*cm, 2.5*cm, 5.8*cm]
        )
        base_style = [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("ALIGN", (1, 0), (3, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("TEXTCOLOR", (2, 1), (2, -1), COLOR_TEXT),
        ]
        events_table.setStyle(TableStyle(base_style + row_styles))
        story.append(events_table)
    else:
        story.append(Paragraph(
            "Im angegebenen Zeitraum wurden keine Sturmtage (Böe ≥ 62 km/h) nachgewiesen.",
            normal
        ))

    story.append(Spacer(1, 0.7*cm))

    # ── LOKALE PRESSEMELDUNGEN (nur wenn Artikel tatsächlich gefunden) ──────────
    if news_result and news_result.get("found") and news_result.get("articles"):
        story.append(HRFlowable(width="100%", thickness=1, color=COLOR_BORDER))
        story.append(Spacer(1, 0.3*cm))
        story.append(Paragraph("Lokale Pressemeldungen (BBV-Net)", h2))
        story.append(Paragraph(
            f"Automatisch recherchierte Berichte zum Schadensdatum bei Bocholter-Borkener Volksblatt (bbv-net.de).",
            small
        ))
        story.append(Spacer(1, 0.3*cm))

        articles = news_result.get("articles", [])
        if articles:
            art_data = [[
                Paragraph("<b>Überschrift</b>", label),
                Paragraph("<b>Datum</b>", label),
            ]]
            for art in articles:
                art_data.append([
                    Paragraph(_escape_markup(art.get("title", "")[:120]), normal),
                    Paragraph(_escape_markup(art.get("date", "")[:20]), small),
                ])
            art_table = Table(art_data, colWidths=[13.0*cm, 3.5*cm])
            art_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("PADDING", (0, 0), (-1, -1), 5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            story.append(art_table)
            story.append(Spacer(1, 0.3*cm))
        else:
            story.append(Paragraph(
                "Keine sturmrelevanten Meldungen in der Nähe des Schadensdatums gefunden.",
                small
            ))

        # Screenshot einbetten (nur wenn vorhanden und Artikel gefunden)
        screenshot_bytes = news_result.get("screenshot") if articles else None
        if screenshot_bytes:
            story.append(Paragraph("Screenshot der BBV-Net Suchergebnisse:", small))
            story.append(Spacer(1, 0.2*cm))
            try:
                from PIL import Image as PILImage
                pil_shot = PILImage.open(io.BytesIO(screenshot_bytes))
                aspect = pil_shot.height / pil_shot.width
                shot_w = 16.5 * cm
                shot_h = shot_w * aspect
                # Höhe begrenzen
                if shot_h > 10 * cm:
                    shot_h = 10 * cm
                story.append(Image(io.BytesIO(screenshot_bytes), width=shot_w, height=shot_h))
                story.append(Paragraph(
                    f"Quelle: {_escape_markup(news_result.get('search_url', 'bbv-net.de'))}",
                    disclaimer
                ))
            except Exception as e:
                logger.warning("BBV-Net Screenshot konnte nicht eingebettet werden: %s", e)

        story.append(Spacer(1, 0.5*cm))

    # ── DATENQUELLEN ──────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_BORDER))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("Verwendete Datenquellen", h2))

    sources_text = []
    if "Open-Meteo (ERA5)" in result.sources_used:
        sources_text.append(
            "• <b>Open-Meteo / ERA5-Reanalyse</b> (ECMWF): Globale Klimareanalyse "
            "stündlicher Wetterdaten ab 1940. Räumliche Auflösung: 9–25 km. "
            "Lizenz: CC BY 4.0. URL: archive-api.open-meteo.com"
        )
    if "DWD" in result.sources_used:
        sources_text.append(
            "• <b>Deutscher Wetterdienst (DWD)</b> – Open Data CDC: "
            "Offizielle Messstation Borken/Westfalen (Station-ID 617), "
            "10-Minuten-Windmessungen inkl. Spitzenböe (FX). "
            "URL: opendata.dwd.de/climate_environment/CDC"
        )
    if "KNMI" in result.sources_used:
        sources_text.append(
            "• <b>KNMI Data Platform</b> (Koninklijk Nederlands Meteorologisch Instituut): "
            "Automatische Wetterstationen Grenzregion NL. Lizenz: CC BY 4.0."
        )

    for s in sources_text:
        story.append(Paragraph(s, disclaimer))
        story.append(Spacer(1, 0.15*cm))

    story.append(Spacer(1, 0.3*cm))

    # ── RECHTLICHER HINWEIS ───────────────────────────────────────────────────
    disclaimer_text = (
        "Rechtlicher Hinweis: Dieses Dokument wurde automatisiert auf Basis öffentlich "
        "zugänglicher Wetterdaten erstellt. Die Angaben dienen als Nachweis im Sinne "
        "der üblichen Sturmklauseln (Windstärke ≥ 8 Bft). Für verbindliche amtliche "
        "Gutachten wenden Sie sich an den Deutschen Wetterdienst (DWD), "
        "Sachgebiet Wettergutachten, Tel. +49 69 8062-0 oder www.dwd.de/wettergutachten."
    )
    story.append(Paragraph(disclaimer_text, disclaimer))

    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(
        f"Erstellt am {report_date.strftime('%d.%m.%Y')} | {_escape_markup(settings.company_footer)}",
        ParagraphStyle("foot", fontSize=7.5, fontName="Helvetica",
            textColor=COLOR_MUTED, alignment=TA_CENTER)
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    buf.seek(0)
    return buf.read()
