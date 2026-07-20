#!/usr/bin/env python3
"""Generate customer-facing sample PDFs for paid report previews.

The sample numbers mirror the demo Kadaster dataset used by the frontend so
customers can preview the paid report formats without hitting live data APIs.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "sample-reports"

BRAND_PURPLE = colors.HexColor("#6c28ff")
BRAND_PINK = colors.HexColor("#ff2e88")
INK = colors.HexColor("#222222")
MUTED = colors.HexColor("#717171")
SOFT = colors.HexColor("#f6f4ff")
BORDER = colors.HexColor("#e9e6f2")
SUCCESS = colors.HexColor("#0f8a5f")
WARNING = colors.HexColor("#b45309")


@dataclass(frozen=True)
class ComparableSale:
    address: str
    distance_m: int
    sale_date: str
    sale_price: int
    surface_m2: int
    price_per_m2: int
    build_year: int
    score: int


TARGET = {
    "address": "Keizersgracht 177, 1016 DR Amsterdam",
    "city": "Amsterdam",
    "property_type": "Canal apartment",
    "build_year": 1902,
    "surface_m2": 85,
    "energy_label": "C",
    "asking_price": 699_000,
    "estimated_value": 685_000,
    "value_low": 630_200,
    "value_high": 739_800,
    "last_sale_price": 547_000,
    "last_sale_date": "12 March 2020",
    "indexed_value": 685_000,
    "postcode_avg_price_m2": 8_106,
    "postcode_transaction_count": 47,
}

COMPARABLES = [
    ComparableSale("Keizersgracht 173", 78, "14 Mar 2024", 695_000, 84, 8_274, 1903, 96),
    ComparableSale("Keizersgracht 181", 42, "18 Jan 2024", 712_000, 88, 8_091, 1901, 94),
    ComparableSale("Prinsengracht 452", 118, "05 Sep 2023", 649_000, 79, 8_215, 1895, 87),
    ComparableSale("Herengracht 339", 205, "22 Nov 2023", 728_000, 92, 7_913, 1908, 81),
    ComparableSale("Reguliersgracht 18", 460, "28 Feb 2024", 741_000, 91, 8_143, 1906, 78),
    ComparableSale("Brouwersgracht 214", 380, "11 Jul 2023", 598_000, 76, 7_868, 1897, 74),
]


def euro(value: int | float | None) -> str:
    if value is None:
        return "-"
    return "EUR {:,.0f}".format(value).replace(",", ".")


def pct(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:+.1f}%"


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "HuisTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=30,
            textColor=INK,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "HuisSubtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=MUTED,
            spaceAfter=16,
        ),
        "h2": ParagraphStyle(
            "HuisSection",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=19,
            textColor=INK,
            spaceBefore=12,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "HuisBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=INK,
            spaceAfter=8,
        ),
        "small": ParagraphStyle(
            "HuisSmall",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=10,
            textColor=MUTED,
        ),
        "label": ParagraphStyle(
            "HuisLabel",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.2,
            leading=9,
            textColor=MUTED,
            alignment=TA_LEFT,
        ),
        "kpi": ParagraphStyle(
            "HuisKpi",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "center": ParagraphStyle(
            "HuisCenter",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=INK,
            alignment=TA_CENTER,
        ),
        "right": ParagraphStyle(
            "HuisRight",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=INK,
            alignment=TA_RIGHT,
        ),
    }


S = styles()


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def header_footer(report_name: str):
    def draw(canvas, doc):
        canvas.saveState()
        width, height = A4
        canvas.setFillColor(BRAND_PURPLE)
        canvas.roundRect(18 * mm, height - 20 * mm, 9 * mm, 9 * mm, 3 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 7)
        canvas.drawCentredString(22.5 * mm, height - 14.4 * mm, "HV")
        canvas.setFillColor(INK)
        canvas.setFont("Helvetica-Bold", 11)
        canvas.drawString(31 * mm, height - 14 * mm, "HuisValue")
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(width - 18 * mm, height - 14 * mm, report_name)
        canvas.setStrokeColor(BORDER)
        canvas.line(18 * mm, height - 25 * mm, width - 18 * mm, height - 25 * mm)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(18 * mm, 13 * mm, "Sample report for preview only. Data is modeled from the HuisValue demo dataset.")
        canvas.drawRightString(width - 18 * mm, 13 * mm, f"Page {doc.page}")
        canvas.restoreState()

    return draw


def doc(path: Path, title: str) -> BaseDocTemplate:
    document = BaseDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=32 * mm,
        bottomMargin=22 * mm,
        title=title,
        author="HuisValue",
    )
    frame = Frame(
        document.leftMargin,
        document.bottomMargin,
        document.width,
        document.height,
        id="normal",
    )
    template = PageTemplate(id="main", frames=[frame], onPage=header_footer(title))
    document.addPageTemplates([template])
    return document


def sample_badge() -> Table:
    table = Table(
        [[p("SAMPLE REPORT", "center")]],
        colWidths=[36 * mm],
        rowHeights=[8 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("TEXTCOLOR", (0, 0), (-1, -1), BRAND_PURPLE),
                ("BOX", (0, 0), (-1, -1), 0.7, BRAND_PURPLE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def kpi_cards(items: list[tuple[str, str, str]], columns: int = 3) -> Table:
    rows = []
    for i in range(0, len(items), columns):
        cells = []
        for label, value, note in items[i : i + columns]:
            cells.append([p(label.upper(), "label"), p(value, "kpi"), p(note, "small")])
        while len(cells) < columns:
            cells.append("")
        rows.append(cells)

    table = Table(rows, colWidths=[(174 / columns) * mm] * columns, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def insight_box(title: str, body: str, tone=SOFT) -> Table:
    table = Table(
        [[p(title, "kpi")], [p(body, "body")]],
        colWidths=[174 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), tone),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def simple_table(rows: list[list[str]], widths: list[float]) -> Table:
    data = [[p(cell, "label") for cell in rows[0]]]
    data.extend([[p(cell, "small") for cell in row] for row in rows[1:]])
    table = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def movement_numbers() -> dict[str, float]:
    increase = TARGET["asking_price"] - TARGET["last_sale_price"]
    growth = increase / TARGET["last_sale_price"] * 100
    indexed_growth = (TARGET["indexed_value"] - TARGET["last_sale_price"]) / TARGET["last_sale_price"] * 100
    premium = (TARGET["asking_price"] - TARGET["indexed_value"]) / TARGET["indexed_value"] * 100
    return {
        "increase": increase,
        "growth": growth,
        "indexed_growth": indexed_growth,
        "premium": premium,
    }


def build_last_sale_pdf() -> Path:
    path = OUTPUT_DIR / "huisvalue-sample-last-sale-report.pdf"
    story = [sample_badge(), Spacer(1, 8)]
    nums = movement_numbers()

    story.extend(
        [
            p("Last Sale Report", "title"),
            p(
                "A buyer-focused view of the target home's last registered sale, indexed market value, and asking-price risk before you decide what to bid.",
                "subtitle",
            ),
            kpi_cards(
                [
                    ("Target address", TARGET["address"], "Demo canal apartment"),
                    ("Last sale", euro(TARGET["last_sale_price"]), TARGET["last_sale_date"]),
                    ("Current asking", euro(TARGET["asking_price"]), "Entered by buyer"),
                    ("Indexed value", euro(TARGET["indexed_value"]), f"{pct(nums['indexed_growth'])} since last sale"),
                    ("Seller premium", pct(nums["premium"]), "Asking vs indexed value"),
                    ("Confidence", "High", "6 comparable sales used"),
                ]
            ),
            Spacer(1, 12),
            insight_box(
                "Buyer verdict",
                "The asking price sits slightly above the indexed value of the last sale. The premium is not extreme, but the bid should be checked against recent nearby sales before moving above the guide price.",
            ),
            p("Price movement since last sale", "h2"),
            simple_table(
                [
                    ["Metric", "Value", "Why it matters"],
                    ["Last registered sale", euro(TARGET["last_sale_price"]), "Kadaster sale on 12 March 2020."],
                    ["Current asking price", euro(TARGET["asking_price"]), "Used to estimate seller price growth."],
                    ["Increase since sale", euro(nums["increase"]), "Difference between sale price and asking price."],
                    ["House growth", pct(nums["growth"]), "Raw growth since the property last changed hands."],
                    ["Indexed market growth", pct(nums["indexed_growth"]), "CBS/Kadaster index applied to the last sale."],
                    ["Asking premium", pct(nums["premium"]), "How far the asking price sits above indexed value."],
                ],
                [43, 38, 93],
            ),
            PageBreak(),
            sample_badge(),
            Spacer(1, 8),
            p("Last Sale Detail", "title"),
            p("The paid PDF highlights the actual values from the report being viewed: last sale price, indexed value, asking price, seller intelligence, and bid-relevant price signals.", "subtitle"),
            kpi_cards(
                [
                    ("Property type", TARGET["property_type"], "Residential use"),
                    ("Living area", f"{TARGET['surface_m2']} m2", "Cached report fact"),
                    ("Build year", str(TARGET["build_year"]), "BAG/Kadaster fact"),
                    ("Energy label", TARGET["energy_label"], "Demo label"),
                    ("Value range low", euro(TARGET["value_low"]), "Conservative estimate"),
                    ("Value range high", euro(TARGET["value_high"]), "Upper estimate"),
                ]
            ),
            p("Last sale and indexed value", "h2"),
            simple_table(
                [
                    ["Field", "Value", "How it is used"],
                    ["Last sale date", TARGET["last_sale_date"], "Shows when the seller bought the home."],
                    ["Last sale price", euro(TARGET["last_sale_price"]), "Ground truth anchor from Kadaster."],
                    ["Indexed value", euro(TARGET["indexed_value"]), "CBS/Kadaster market movement applied to the last sale."],
                    ["Current asking price", euro(TARGET["asking_price"]), "Compared against indexed value and local growth."],
                ],
                [45, 44, 85],
            ),
            p("Seller intelligence", "h2"),
            simple_table(
                [
                    ["Signal", "Value", "Buyer meaning"],
                    ["Estimated seller gain", euro(TARGET["indexed_value"] - TARGET["last_sale_price"]), f"{pct(nums['indexed_growth'])} indexed appreciation."],
                    ["Seller premium", pct(nums["premium"]), "Asking price compared with indexed value."],
                    ["Years held", "6+ years", "Normal tenure; no short-hold warning in this example."],
                    ["Price verdict", "Slight premium", "Negotiate using indexed value as the first anchor."],
                ],
                [45, 44, 85],
            ),
            p("Price assessment", "h2"),
            simple_table(
                [
                    ["Metric", "Value", "Why it matters"],
                    ["Value range low", euro(TARGET["value_low"]), "Conservative estimate."],
                    ["Balanced value", euro(TARGET["estimated_value"]), "Indexed value used as the buyer anchor."],
                    ["Value range high", euro(TARGET["value_high"]), "Upper estimate before comparable-sale checks."],
                    ["Asking premium", pct(nums["premium"]), "How much the seller is asking above indexed value."],
                ],
                [45, 44, 85],
            ),
            insight_box(
                "Negotiation angle",
                "Use the indexed value as a grounded anchor, then compare with the Sold Homes Benchmark report when you need recent local sale evidence for your offer ceiling.",
                colors.HexColor("#fff7ed"),
            ),
            p("Important disclaimer", "h2"),
            p(
                "HuisValue reports are decision-support tools and not a formal valuation, mortgage advice, or legal due diligence. Buyers should verify decisive facts with their makelaar, lender, and notary before making an offer.",
                "body",
            ),
        ]
    )

    doc(path, "HuisValue Sample Last Sale Report").build(story)
    return path


def build_benchmark_pdf() -> Path:
    path = OUTPUT_DIR / "huisvalue-sample-sold-home-benchmark-report.pdf"
    story = [sample_badge(), Spacer(1, 8)]

    avg_sale_price = round(sum(c.sale_price for c in COMPARABLES) / len(COMPARABLES))
    avg_price_m2 = round(sum(c.price_per_m2 for c in COMPARABLES) / len(COMPARABLES))
    best = max(COMPARABLES, key=lambda c: c.score)
    suggested_ceiling = round((TARGET["estimated_value"] + best.sale_price) / 2 / 1000) * 1000

    story.extend(
        [
            p("Sold Homes Benchmark Report", "title"),
            p(
                "A comparable-sales view that helps buyers understand what similar nearby homes actually sold for before committing to an offer.",
                "subtitle",
            ),
            kpi_cards(
                [
                    ("Target address", TARGET["address"], "Demo canal apartment"),
                    ("Target asking", euro(TARGET["asking_price"]), f"{TARGET['surface_m2']} m2"),
                    ("Best comparable", best.address, f"{best.score}% similarity"),
                    ("Average comp sale", euro(avg_sale_price), f"{len(COMPARABLES)} nearby sales"),
                    ("Average comp EUR/m2", euro(avg_price_m2), "Comparable set"),
                    ("Suggested ceiling", euro(suggested_ceiling), "Without upgrades"),
                ]
            ),
            Spacer(1, 12),
            insight_box(
                "Buyer verdict",
                "The asking price is within the recent comparable band but above the modeled midpoint. A disciplined buyer would use the strongest nearby comparable as support and avoid stretching materially beyond the suggested ceiling unless the home has clear upgrades.",
            ),
            p("Comparable sale set", "h2"),
            simple_table(
                [["Address", "Distance", "Sale date", "Sale price", "EUR/m2", "Match"]]
                + [
                    [
                        c.address,
                        f"{c.distance_m} m",
                        c.sale_date,
                        euro(c.sale_price),
                        euro(c.price_per_m2),
                        f"{c.score}%",
                    ]
                    for c in COMPARABLES
                ],
                [46, 22, 28, 34, 29, 15],
            ),
            PageBreak(),
            sample_badge(),
            Spacer(1, 8),
            p("Benchmark Interpretation", "title"),
            p("The live report scores candidates by distance, living area, recency, build year, energy label, and local price density.", "subtitle"),
            kpi_cards(
                [
                    ("Closest sale", "42 m", "Keizersgracht 181"),
                    ("Highest match", "96%", "Keizersgracht 173"),
                    ("Price range", "EUR 598k-741k", "Comparable set"),
                    ("Target estimate", euro(TARGET["estimated_value"]), "HuisValue valuation"),
                    ("Postcode average", euro(TARGET["postcode_avg_price_m2"]), "EUR/m2"),
                    ("Transactions", str(TARGET["postcode_transaction_count"]), "Postcode context"),
                ]
            ),
            p("Offer guidance", "h2"),
            simple_table(
                [
                    ["Offer posture", "Indicative amount", "When it fits"],
                    ["Conservative", euro(TARGET["value_low"]), "Useful if inspection risks or renovation needs appear."],
                    ["Balanced", euro(TARGET["estimated_value"]), "Aligned with indexed value and comparable midpoint."],
                    ["Competitive ceiling", euro(suggested_ceiling), "Only if the home condition is above the comparable set."],
                    ["Stretch bid", euro(TARGET["asking_price"]), "Requires confidence in scarcity, upgrades, and financing headroom."],
                ],
                [42, 42, 90],
            ),
            insight_box(
                "Negotiation angle",
                "The best support for a firm offer is the pair of Keizersgracht comparables: they are close, recent, similar in size, and sit near the current asking price.",
                colors.HexColor("#ecfdf5"),
            ),
            PageBreak(),
            sample_badge(),
            Spacer(1, 8),
            p("Methodology and Data Notes", "title"),
            p("This preview shows the paid report format using the demo dataset. Live reports use the selected property and paid data-access flow.", "subtitle"),
            simple_table(
                [
                    ["Step", "What the live report does", "Why it matters"],
                    ["1. Resolve target", "Loads address and cached property facts.", "Keeps the benchmark tied to the right BAG object."],
                    ["2. Find candidates", "Lists nearby homes from BAG/PDOK and paid Kadaster data.", "Prevents comparing against irrelevant properties."],
                    ["3. Score similarity", "Weights size, distance, age, recency, type, and energy label.", "Highlights the sales most useful in negotiation."],
                    ["4. Guide offer", "Compares asking price with sale evidence and value range.", "Supports a practical bid ceiling."],
                ],
                [28, 78, 68],
            ),
            p("Important disclaimer", "h2"),
            p(
                "Comparable-sales reports are buyer intelligence, not a formal taxatie. Always combine the report with inspection results, financing limits, and professional advice before placing a binding offer.",
                "body",
            ),
        ]
    )

    doc(path, "HuisValue Sample Sold Homes Benchmark Report").build(story)
    return path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = [build_last_sale_pdf(), build_benchmark_pdf()]
    for output in outputs:
        print(output.relative_to(ROOT))


if __name__ == "__main__":
    main()
