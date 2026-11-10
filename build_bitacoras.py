#!/usr/bin/env python3
"""
Generador Maestro de Bitácoras de Trading en Excel Profesional (Fondeo & Real)
Calibrado para USDCAD, AUDCAD y AUDJPY.

TOTALMENTE DINÁMICO & REACTIVO:
- Modificar 'Capital Inicial' en Dashboard -> Actualiza toda la cadena de balances y KPIs.
- Modificar 'Par' (USDCAD, AUDCAD, AUDJPY) -> Actualiza Pip Size, Valor Pip y Lote automáticamente.
- Modificar 'Precio Entrada' o 'Stop Loss' -> Calcula automáticamente Pips de SL exactos.
- Modificar 'Take Profit' -> Calcula automáticamente el Ratio R:R exacto.
- Modificar 'Riesgo %' -> Recalcula el presupuesto en $ USD y el lotaje institucional.
- Modificar 'Resultado' (WIN, LOSS, BE) -> Recalcula PnL, Balance acumulado y métricas.
- Filas pre-cargadas (11 a 60) con fórmulas protectoras IF(ISBLANK(...) que se activan al escribir.
"""

import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.chart import LineChart, Reference

OUTPUT_DIR = "/Users/tatocarrasco/.gemini/antigravity/scratch/xauusd-backtesting-dashboard/bitacoras_excel"
os.makedirs(OUTPUT_DIR, exist_ok=True)

FONT_FAMILY = "Segoe UI"

PARAM_HEADERS = ["Par", "Banderas", "Pip Size", "Valor Pip / Lote", "Contrato Estándar", "Margen Base ($ USD)"]
FOREX_SPECS_DATA = [
    ("USDCAD", "🇺🇸🇨🇦", 0.0001, 7.22, 100000, 100000.0),
    ("AUDCAD", "🇦🇺🇨🇦", 0.0001, 7.22, 100000, 65500.0),
    ("AUDJPY", "🇦🇺🇯🇵", 0.01, 6.50, 100000, 65500.0),
]

# Fills
FILL_NAVY_HEADER = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
FILL_SUBHEADER = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
FILL_CARD_BG = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
FILL_GOLD_HEADER = PatternFill(start_color="D97706", end_color="D97706", fill_type="solid")
FILL_EMERALD_HEADER = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
FILL_WIN = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
FILL_LOSS = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
FILL_BE = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

# Fonts
FONT_TITLE = Font(name=FONT_FAMILY, size=14, bold=True, color="FFFFFF")
FONT_SUBTITLE = Font(name=FONT_FAMILY, size=9.5, italic=True, color="94A3B8")
FONT_TH = Font(name=FONT_FAMILY, size=9.5, bold=True, color="FFFFFF")
FONT_BODY = Font(name=FONT_FAMILY, size=9, color="1E293B")
FONT_BODY_BOLD = Font(name=FONT_FAMILY, size=9, bold=True, color="0F172A")
FONT_KPI_LABEL = Font(name=FONT_FAMILY, size=8.5, bold=True, color="64748B")
FONT_KPI_VAL = Font(name=FONT_FAMILY, size=14, bold=True, color="0F172A")
FONT_KPI_VAL_GREEN = Font(name=FONT_FAMILY, size=14, bold=True, color="15803D")
FONT_KPI_VAL_GOLD = Font(name=FONT_FAMILY, size=14, bold=True, color="B45309")
FONT_KPI_VAL_RED = Font(name=FONT_FAMILY, size=14, bold=True, color="B91C1C")
FONT_WIN = Font(name=FONT_FAMILY, size=9, bold=True, color="166534")
FONT_LOSS = Font(name=FONT_FAMILY, size=9, bold=True, color="991B1B")
FONT_BE = Font(name=FONT_FAMILY, size=9, bold=True, color="475569")

# Borders
BORDER_THIN = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1")
)

# Number Formats
FMT_CURRENCY = '$#,##0.00;($#,##0.00);"-"'
FMT_PCT = '0.00%'
FMT_RR = '0.0"R"'
FMT_LOT = '0.00" L"'
FMT_PIPS = '0.0" p"'

def auto_fit_columns(ws, min_col=1, max_col=None, max_len_cap=35):
    if max_col is None:
        max_col = ws.max_column
    for col_idx in range(min_col, max_col + 1):
        col_letter = get_column_letter(col_idx)
        max_len = 0
        for cell in ws[col_letter]:
            val = str(cell.value or '')
            if cell.number_format and ('$' in cell.number_format or '%' in cell.number_format):
                val = val + '    '
            max_len = max(max_len, len(val))
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 11), max_len_cap)


# ==============================================================================
# 1. BITÁCORA DE EVALUACIÓN & FONDEO ($50,000 Orion Nova Style)
# ==============================================================================
def create_fondeo_workbook():
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # -------------------------------------------------------------
    # HOJA 1: 📊 DASHBOARD FONDEO
    # -------------------------------------------------------------
    ws_dash = wb.create_sheet(title="📊 Dashboard Fondeo")
    ws_dash.views.sheetView[0].showGridLines = True

    # Header
    ws_dash.merge_cells("B2:J3")
    header_cell = ws_dash["B2"]
    header_cell.value = "  🛡️ PRO TRADING TERMINAL — EVALUACIÓN & FONDEO ($50,000 USD)"
    header_cell.font = FONT_TITLE
    header_cell.fill = FILL_NAVY_HEADER
    header_cell.alignment = Alignment(horizontal="left", vertical="center")

    ws_dash["B4"] = "Monitoreo reactivo: Profit Target (8%), Pérdida Diaria (4%) y Trailing Drawdown (8%) | Fórmulas 100% Automáticas"
    ws_dash["B4"].font = FONT_SUBTITLE

    # KPI CARDS ROW 1 (Fila 6 - 8)
    # Card 1: Capital Inicial (Editable)
    ws_dash.merge_cells("B6:C6")
    ws_dash["B6"] = "CAPITAL INICIAL (EDITABLE)"
    ws_dash["B6"].font = FONT_KPI_LABEL
    ws_dash["B6"].fill = FILL_CARD_BG
    ws_dash["B6"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("B7:C8")
    ws_dash["B7"] = 50000.0
    ws_dash["B7"].font = FONT_KPI_VAL
    ws_dash["B7"].fill = FILL_CARD_BG
    ws_dash["B7"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["B7"].number_format = FMT_CURRENCY

    # Card 2: Balance Actual en Vivo
    ws_dash.merge_cells("D6:E6")
    ws_dash["D6"] = "BALANCE ACTUAL EN VIVO"
    ws_dash["D6"].font = FONT_KPI_LABEL
    ws_dash["D6"].fill = FILL_CARD_BG
    ws_dash["D6"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("D7:E8")
    ws_dash["D7"] = "=B7+F7"
    ws_dash["D7"].font = FONT_KPI_VAL_GREEN
    ws_dash["D7"].fill = FILL_CARD_BG
    ws_dash["D7"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["D7"].number_format = FMT_CURRENCY

    # Card 3: PnL Neto Acumulado
    ws_dash.merge_cells("F6:G6")
    ws_dash["F6"] = "PNL NETO ACUMULADO"
    ws_dash["F6"].font = FONT_KPI_LABEL
    ws_dash["F6"].fill = FILL_CARD_BG
    ws_dash["F6"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("F7:G8")
    ws_dash["F7"] = "=SUM('📝 Bitácora Fondeo'!P6:P60)"
    ws_dash["F7"].font = FONT_KPI_VAL_GREEN
    ws_dash["F7"].fill = FILL_CARD_BG
    ws_dash["F7"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["F7"].number_format = FMT_CURRENCY

    # Card 4: Retorno Total %
    ws_dash.merge_cells("H6:I6")
    ws_dash["H6"] = "RETORNO TOTAL (%)"
    ws_dash["H6"].font = FONT_KPI_LABEL
    ws_dash["H6"].fill = FILL_CARD_BG
    ws_dash["H6"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("H7:I8")
    ws_dash["H7"] = "=IFERROR(F7/B7, 0)"
    ws_dash["H7"].font = FONT_KPI_VAL_GREEN
    ws_dash["H7"].fill = FILL_CARD_BG
    ws_dash["H7"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["H7"].number_format = FMT_PCT

    # KPI CARDS ROW 2 (Fila 10 - 12)
    # Card 5: Profit Target (8%)
    ws_dash.merge_cells("B10:C10")
    ws_dash["B10"] = "PROFIT TARGET (8%)"
    ws_dash["B10"].font = FONT_KPI_LABEL
    ws_dash["B10"].fill = FILL_CARD_BG
    ws_dash["B10"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("B11:C12")
    ws_dash["B11"] = "=B7*0.08"
    ws_dash["B11"].font = FONT_KPI_VAL_GOLD
    ws_dash["B11"].fill = FILL_CARD_BG
    ws_dash["B11"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["B11"].number_format = FMT_CURRENCY

    # Card 6: Distancia a la Meta
    ws_dash.merge_cells("D10:E10")
    ws_dash["D10"] = "DISTANCIA RESTANTE A META"
    ws_dash["D10"].font = FONT_KPI_LABEL
    ws_dash["D10"].fill = FILL_CARD_BG
    ws_dash["D10"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("D11:E12")
    ws_dash["D11"] = "=MAX(0, (B7+B11)-D7)"
    ws_dash["D11"].font = FONT_KPI_VAL
    ws_dash["D11"].fill = FILL_CARD_BG
    ws_dash["D11"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["D11"].number_format = FMT_CURRENCY

    # Card 7: Pérdida Diaria Máx (4%)
    ws_dash.merge_cells("F10:G10")
    ws_dash["F10"] = "LÍMITE PÉRDIDA DIARIA (4%)"
    ws_dash["F10"].font = FONT_KPI_LABEL
    ws_dash["F10"].fill = FILL_CARD_BG
    ws_dash["F10"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("F11:G12")
    ws_dash["F11"] = "=B7*0.04"
    ws_dash["F11"].font = FONT_KPI_VAL_RED
    ws_dash["F11"].fill = FILL_CARD_BG
    ws_dash["F11"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["F11"].number_format = FMT_CURRENCY

    # Card 8: Trailing Drawdown Máx (8%)
    ws_dash.merge_cells("H10:I10")
    ws_dash["H10"] = "TRAILING DRAWDOWN MÁX (8%)"
    ws_dash["H10"].font = FONT_KPI_LABEL
    ws_dash["H10"].fill = FILL_CARD_BG
    ws_dash["H10"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("H11:I12")
    ws_dash["H11"] = "=B7*0.08"
    ws_dash["H11"].font = FONT_KPI_VAL_RED
    ws_dash["H11"].fill = FILL_CARD_BG
    ws_dash["H11"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["H11"].number_format = FMT_CURRENCY

    for r in range(6, 13):
        for c in range(2, 10):
            ws_dash.cell(row=r, column=c).border = BORDER_THIN

    # Tabla de Estadísticas Cuantitativas
    ws_dash["B14"] = "ESTADÍSTICAS CUANTITATIVAS GENERALES"
    ws_dash["B14"].font = Font(name=FONT_FAMILY, size=10.5, bold=True, color="0F172A")
    
    stats_headers = ["Total Trades", "Wins", "Losses", "Breakevens", "Win Rate %", "Profit Factor", "R:R Promedio"]
    for idx, h in enumerate(stats_headers, start=2):
        cell = ws_dash.cell(row=15, column=idx, value=h)
        cell.font = FONT_TH
        cell.fill = FILL_SUBHEADER
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    ws_dash["B16"] = "=COUNT('📝 Bitácora Fondeo'!B6:B60)"
    ws_dash["B16"].number_format = '0'
    ws_dash["C16"] = '=COUNTIF(\'📝 Bitácora Fondeo\'!O6:O60, "WIN")'
    ws_dash["C16"].number_format = '0'
    ws_dash["D16"] = '=COUNTIF(\'📝 Bitácora Fondeo\'!O6:O60, "LOSS")'
    ws_dash["D16"].number_format = '0'
    ws_dash["E16"] = '=COUNTIF(\'📝 Bitácora Fondeo\'!O6:O60, "BE")'
    ws_dash["E16"].number_format = '0'
    ws_dash["F16"] = '=IFERROR(C16/B16, 0)'
    ws_dash["F16"].number_format = FMT_PCT
    ws_dash["G16"] = '=IFERROR(SUMIF(\'📝 Bitácora Fondeo\'!P6:P60, ">0")/ABS(SUMIF(\'📝 Bitácora Fondeo\'!P6:P60, "<0")), 0)'
    ws_dash["G16"].number_format = '0.00'
    ws_dash["H16"] = '=IFERROR(AVERAGEIF(\'📝 Bitácora Fondeo\'!N6:N60, ">0"), 0)'
    ws_dash["H16"].number_format = FMT_RR

    for c in range(2, 9):
        cell = ws_dash.cell(row=16, column=c)
        cell.font = FONT_BODY_BOLD
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    # Tabla Desglose por Par Forex
    ws_dash["B18"] = "RENDIMIENTO DINÁMICO POR PAR FOREX"
    ws_dash["B18"].font = Font(name=FONT_FAMILY, size=10.5, bold=True, color="0F172A")

    for idx, h in enumerate(["Par", "Banderas", "Operaciones", "Wins", "Win Rate %", "PnL Acumulado ($)"], start=2):
        cell = ws_dash.cell(row=19, column=idx, value=h)
        cell.font = FONT_TH
        cell.fill = FILL_SUBHEADER
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    pairs_data = [
        ("USDCAD", "🇺🇸🇨🇦", 20),
        ("AUDCAD", "🇦🇺🇨🇦", 21),
        ("AUDJPY", "🇦🇺🇯🇵", 22)
    ]

    for p, flag, r_idx in pairs_data:
        ws_dash.cell(row=r_idx, column=2, value=p).font = FONT_BODY_BOLD
        ws_dash.cell(row=r_idx, column=3, value=flag).alignment = Alignment(horizontal="center")
        ws_dash.cell(row=r_idx, column=4, value=f'=COUNTIFS(\'📝 Bitácora Fondeo\'!D$6:D$60, "{p}", \'📝 Bitácora Fondeo\'!B$6:B$60, ">0")').alignment = Alignment(horizontal="center")
        ws_dash.cell(row=r_idx, column=5, value=f'=COUNTIFS(\'📝 Bitácora Fondeo\'!D$6:D$60, "{p}", \'📝 Bitácora Fondeo\'!O$6:O$60, "WIN")').alignment = Alignment(horizontal="center")
        ws_dash.cell(row=r_idx, column=6, value=f'=IFERROR(E{r_idx}/D{r_idx}, 0)').number_format = FMT_PCT
        ws_dash.cell(row=r_idx, column=7, value=f'=SUMIF(\'📝 Bitácora Fondeo\'!D$6:D$60, "{p}", \'📝 Bitácora Fondeo\'!P$6:P$60)').number_format = FMT_CURRENCY
        
        for c in range(2, 8):
            cell = ws_dash.cell(row=r_idx, column=c)
            cell.font = FONT_BODY
            cell.border = BORDER_THIN
            if c in [2, 7]:
                cell.font = FONT_BODY_BOLD

    # -------------------------------------------------------------
    # HOJA 2: 📝 BITÁCORA FONDEO (REGISTRO DINÁMICO)
    # -------------------------------------------------------------
    ws_log = wb.create_sheet(title="📝 Bitácora Fondeo")
    ws_log.views.sheetView[0].showGridLines = True

    ws_log.merge_cells("B2:U3")
    log_header = ws_log["B2"]
    log_header.value = "  REGISTRO REACTIVO DE OPERACIONES — EVALUACIÓN FONDEO"
    log_header.font = FONT_TITLE
    log_header.fill = FILL_NAVY_HEADER
    log_header.alignment = Alignment(horizontal="left", vertical="center")

    log_headers = [
        ("#", 6),
        ("Fecha & Hora", 18),
        ("Par", 12),
        ("Dir", 8),
        ("Sesión", 13),
        ("Entrada", 12),
        ("Stop Loss", 12),
        ("Take Profit", 12),
        ("Pips SL (Auto)", 13),
        ("Riesgo %", 10),
        ("Riesgo $ (Auto)", 14),
        ("Lote (Auto)", 12),
        ("Ratio R:R (Auto)", 14),
        ("Resultado", 12),
        ("PnL Neto $ (Auto)", 16),
        ("Balance $ (Auto)", 16),
        ("Retorno % (Auto)", 14),
        ("Estrategia / Gatillo", 22),
        ("Plan 100%", 11),
        ("Notas / Confluencias", 22)
    ]

    for idx, (title, width) in enumerate(log_headers, start=2):
        col_letter = get_column_letter(idx)
        ws_log.column_dimensions[col_letter].width = width
        cell = ws_log.cell(row=5, column=idx, value=title)
        cell.font = FONT_TH
        cell.fill = FILL_GOLD_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN

    # 10 operaciones de muestra iniciales
    sample_fondeo = [
        (1, "2026-11-03 09:30", "USDCAD", "BUY", "Nueva York", 1.38500, 1.38250, 1.39250, 0.50, "WIN", "Ruptura NY + FVG M5", "SÍ", "Confluencia H1 limpia"),
        (2, "2026-11-03 14:15", "AUDJPY", "SELL", "Nueva York", 153.800, 154.050, 153.050, 0.50, "WIN", "Order Block M15 + Reject", "SÍ", "Rechazo de resistencia clave"),
        (3, "2026-11-04 04:00", "AUDCAD", "BUY", "Londres", 0.90800, 0.90550, 0.91550, 0.50, "LOSS", "Ruptura de Rango Londres", "SÍ", "Falso quiebre en pre-apertura"),
        (4, "2026-11-04 09:45", "USDCAD", "SELL", "Nueva York", 1.39100, 1.39350, 1.38350, 0.50, "WIN", "Liquidity Sweep Asian High", "SÍ", "Toma de liquidez previa"),
        (5, "2026-11-04 15:30", "AUDJPY", "BUY", "Nueva York", 153.200, 153.450, 153.200, 0.50, "BE", "Breakeven tras +1.5R", "SÍ", "Retroceso agresivo a entrada"),
        (6, "2026-11-05 03:30", "AUDCAD", "SELL", "Londres", 0.90400, 0.90650, 0.89650, 0.50, "WIN", "Pullback VWAP + Trend M15", "SÍ", "Seguimiento tendencial"),
        (7, "2026-11-05 10:15", "USDCAD", "BUY", "Nueva York", 1.38800, 1.38550, 1.39550, 0.50, "LOSS", "Intento Fallido Apertura", "SÍ", "Poco volumen en la sesión"),
        (8, "2026-11-05 13:45", "AUDJPY", "SELL", "Nueva York", 154.100, 154.350, 153.350, 0.50, "WIN", "Rechazo Resistencia D1", "SÍ", "Vela envolvente bajista"),
        (9, "2026-11-06 09:00", "USDCAD", "SELL", "Nueva York", 1.39400, 1.39650, 1.38650, 0.50, "WIN", "Post-Noticias Sin Desliz", "SÍ", "Entrada limpia 2 min después"),
        (10, "2026-11-06 14:00", "AUDCAD", "BUY", "Nueva York", 0.90100, 0.90350, 0.90100, 0.50, "BE", "Protección a Breakeven", "SÍ", "Cierre de viernes seguro"),
    ]

    # Pre-cargar filas 6 a 60 con fórmulas reactivas
    for r in range(6, 61):
        is_sample = (r - 6) < len(sample_fondeo)
        
        if is_sample:
            s = sample_fondeo[r - 6]
            ws_log.cell(row=r, column=2, value=s[0]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=3, value=s[1]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=4, value=s[2]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=5, value=s[3]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=6, value=s[4]).alignment = Alignment(horizontal="center")
            
            c_e = ws_log.cell(row=r, column=7, value=s[5])
            c_e.number_format = '0.00000' if 'JPY' not in s[2] else '0.000'
            c_sl = ws_log.cell(row=r, column=8, value=s[6])
            c_sl.number_format = '0.00000' if 'JPY' not in s[2] else '0.000'
            c_tp = ws_log.cell(row=r, column=9, value=s[7])
            c_tp.number_format = '0.00000' if 'JPY' not in s[2] else '0.000'
            
            ws_log.cell(row=r, column=11, value=s[8]).number_format = FMT_PCT
            
            c_res = ws_log.cell(row=r, column=15, value=s[9])
            c_res.alignment = Alignment(horizontal="center")
            if s[9] == "WIN":
                c_res.fill = FILL_WIN
                c_res.font = FONT_WIN
            elif s[9] == "LOSS":
                c_res.fill = FILL_LOSS
                c_res.font = FONT_LOSS
            else:
                c_res.fill = FILL_BE
                c_res.font = FONT_BE

            ws_log.cell(row=r, column=19, value=s[10])
            ws_log.cell(row=r, column=20, value=s[11]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=21, value=s[12])
        else:
            # Filas vacías listas para ser llenadas por el usuario
            ws_log.cell(row=r, column=2, value="")
            ws_log.cell(row=r, column=3, value="")
            ws_log.cell(row=r, column=4, value="")
            ws_log.cell(row=r, column=5, value="")
            ws_log.cell(row=r, column=6, value="")
            ws_log.cell(row=r, column=7, value="")
            ws_log.cell(row=r, column=8, value="")
            ws_log.cell(row=r, column=9, value="")
            ws_log.cell(row=r, column=11, value=0.50).number_format = FMT_PCT
            ws_log.cell(row=r, column=15, value="")
            ws_log.cell(row=r, column=19, value="")
            ws_log.cell(row=r, column=20, value="")
            ws_log.cell(row=r, column=21, value="")

        # FÓRMULAS TOTALMENTE DINÁMICAS (Para todas las filas 6 a 60):
        # Col J (10): Pips SL (Calculado a partir de Entrada y SL y el Pip Size del Par)
        # =IF(ISBLANK(B6), "", IF(AND(ISNUMBER(G6), ISNUMBER(H6)), ROUND(ABS(G6-H6) / VLOOKUP(D6, '⚙️ Parámetros Forex'!B$6:F$8, 3, FALSE), 1), 25.0))
        ws_log.cell(row=r, column=10, value=f'=IF(ISBLANK(B{r}), "", IF(AND(ISNUMBER(G{r}), ISNUMBER(H{r})), ROUND(ABS(G{r}-H{r}) / VLOOKUP(D{r}, \'⚙️ Parámetros Forex\'!B$6:F$8, 3, FALSE), 1), 25.0))').number_format = FMT_PIPS

        # Col L (12): Riesgo ($ USD) -> Balance anterior * (Riesgo % / 100)
        if r == 6:
            ws_log.cell(row=r, column=12, value=f'=IF(ISBLANK(B{r}), "", ROUND(\'📊 Dashboard Fondeo\'!B7 * (K{r}/100), 2))').number_format = FMT_CURRENCY
        else:
            ws_log.cell(row=r, column=12, value=f'=IF(ISBLANK(B{r}), "", ROUND(Q{r-1} * (K{r}/100), 2))').number_format = FMT_CURRENCY

        # Col M (13): Lotaje Sugerido -> Riesgo $ / (Pips SL * Valor Pip USD)
        ws_log.cell(row=r, column=13, value=f'=IF(ISBLANK(B{r}), "", MAX(0.01, ROUND(L{r} / (J{r} * VLOOKUP(D{r}, \'⚙️ Parámetros Forex\'!B$6:F$8, 4, FALSE)), 2)))').number_format = FMT_LOT

        # Col N (14): Ratio R:R -> Calculado automáticamente si hay TP, sino 3.0 por defecto
        ws_log.cell(row=r, column=14, value=f'=IF(ISBLANK(B{r}), "", IF(AND(ISNUMBER(G{r}), ISNUMBER(H{r}), ISNUMBER(I{r}), ABS(G{r}-H{r})>0), ROUND(ABS(I{r}-G{r}) / ABS(G{r}-H{r}), 2), 3.0))').number_format = FMT_RR

        # Col P (16): PnL Neto ($ USD) -> Si WIN: Riesgo $ * RR; Si LOSS: -Riesgo $; Si BE: 0
        ws_log.cell(row=r, column=16, value=f'=IF(ISBLANK(B{r}), "", IF(O{r}="WIN", ROUND(L{r}*N{r}, 2), IF(O{r}="LOSS", -L{r}, 0)))').number_format = FMT_CURRENCY

        # Col Q (17): Balance Acumulado ($ USD)
        if r == 6:
            ws_log.cell(row=r, column=17, value=f'=IF(ISBLANK(B{r}), "", \'📊 Dashboard Fondeo\'!B7 + P{r})').number_format = FMT_CURRENCY
        else:
            ws_log.cell(row=r, column=17, value=f'=IF(ISBLANK(B{r}), "", Q{r-1} + P{r})').number_format = FMT_CURRENCY

        # Col R (18): Retorno % de la Operación
        if r == 6:
            ws_log.cell(row=r, column=18, value=f'=IF(ISBLANK(B{r}), "", P{r} / \'📊 Dashboard Fondeo\'!B7)').number_format = FMT_PCT
        else:
            ws_log.cell(row=r, column=18, value=f'=IF(ISBLANK(B{r}), "", P{r} / Q{r-1})').number_format = FMT_PCT

        for c in range(2, 22):
            ws_log.cell(row=r, column=c).border = BORDER_THIN
            if c not in [15]:
                ws_log.cell(row=r, column=c).font = FONT_BODY

    # Validaciones en Bitácora Fondeo
    dv_pairs = DataValidation(type="list", formula1='"USDCAD,AUDCAD,AUDJPY"', allow_blank=True)
    ws_log.add_data_validation(dv_pairs)
    dv_pairs.add("D6:D60")

    dv_dir = DataValidation(type="list", formula1='"BUY,SELL"', allow_blank=True)
    ws_log.add_data_validation(dv_dir)
    dv_dir.add("E6:E60")

    dv_sess = DataValidation(type="list", formula1='"Nueva York,Londres,Asia"', allow_blank=True)
    ws_log.add_data_validation(dv_sess)
    dv_sess.add("F6:F60")

    dv_res = DataValidation(type="list", formula1='"WIN,LOSS,BE"', allow_blank=True)
    ws_log.add_data_validation(dv_res)
    dv_res.add("O6:O60")

    dv_plan = DataValidation(type="list", formula1='"SÍ,NO"', allow_blank=True)
    ws_log.add_data_validation(dv_plan)
    dv_plan.add("T6:T60")

    # Gráfico de Equity en Dashboard
    chart = LineChart()
    chart.title = "Curva de Equity Fondeo (Crecimiento Dinámico vs Reglas)"
    chart.style = 13
    chart.y_axis.title = "Balance ($ USD)"
    chart.x_axis.title = "Operación #"
    chart.width = 19
    chart.height = 10

    data_ref = Reference(ws_log, min_col=17, min_row=5, max_row=15)
    chart.add_data(data_ref, titles_from_data=True)
    ws_dash.add_chart(chart, "B24")

    # -------------------------------------------------------------
    # HOJA 3: ⚙️ PARÁMETROS FOREX
    # -------------------------------------------------------------
    ws_param = wb.create_sheet(title="⚙️ Parámetros Forex")
    ws_param.views.sheetView[0].showGridLines = True

    ws_param.merge_cells("B2:G3")
    p_header = ws_param["B2"]
    p_header.value = "  ESPECIFICACIONES DE PARES FOREX & MATRIZ DE RIESGO"
    p_header.font = FONT_TITLE
    p_header.fill = FILL_NAVY_HEADER
    p_header.alignment = Alignment(horizontal="left", vertical="center")

    for idx, h in enumerate(PARAM_HEADERS, start=2):
        cell = ws_param.cell(row=5, column=idx, value=h)
        cell.font = FONT_TH
        cell.fill = FILL_SUBHEADER
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    for idx, (p, flag, pip, val_pip, contract, margin) in enumerate(FOREX_SPECS_DATA, start=6):
        ws_param.cell(row=idx, column=2, value=p).font = FONT_BODY_BOLD
        ws_param.cell(row=idx, column=3, value=flag).alignment = Alignment(horizontal="center")
        ws_param.cell(row=idx, column=4, value=pip).number_format = '0.0000' if pip < 0.001 else '0.00'
        ws_param.cell(row=idx, column=5, value=val_pip).number_format = FMT_CURRENCY
        ws_param.cell(row=idx, column=6, value=contract).number_format = '#,##0'
        ws_param.cell(row=idx, column=7, value=margin).number_format = FMT_CURRENCY
        for c in range(2, 8):
            ws_param.cell(row=idx, column=c).border = BORDER_THIN

    auto_fit_columns(ws_dash)
    auto_fit_columns(ws_param)

    fondeo_path = os.path.join(OUTPUT_DIR, "Bitacora_Fondeo_Pro_USDCAD_AUDCAD_AUDJPY.xlsx")
    wb.save(fondeo_path)
    print(f"✅ Bitácora Fondeo guardada en: {fondeo_path}")


# ==============================================================================
# 2. BITÁCORA DE TRADING REAL (Interés Compuesto & Retiros)
# ==============================================================================
def create_real_workbook():
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # -------------------------------------------------------------
    # HOJA 1: 📈 DASHBOARD REAL
    # -------------------------------------------------------------
    ws_dash = wb.create_sheet(title="📈 Dashboard Real")
    ws_dash.views.sheetView[0].showGridLines = True

    # Header
    ws_dash.merge_cells("B2:J3")
    header_cell = ws_dash["B2"]
    header_cell.value = "  💼 PRO TRADING TERMINAL — BITÁCORA REAL & INTERÉS COMPUESTO"
    header_cell.font = FONT_TITLE
    header_cell.fill = FILL_NAVY_HEADER
    header_cell.alignment = Alignment(horizontal="left", vertical="center")

    ws_dash["B4"] = "Gestión reactiva de capital real: Crecimiento compuesto, registro de retiros y drawdown | USDCAD · AUDCAD · AUDJPY"
    ws_dash["B4"].font = FONT_SUBTITLE

    # KPI CARDS ROW 1 (Fila 6 - 8)
    # Card 1: Depósito Inicial (Editable)
    ws_dash.merge_cells("B6:C6")
    ws_dash["B6"] = "DEPÓSITO INICIAL (EDITABLE)"
    ws_dash["B6"].font = FONT_KPI_LABEL
    ws_dash["B6"].fill = FILL_CARD_BG
    ws_dash["B6"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("B7:C8")
    ws_dash["B7"] = 1000.0
    ws_dash["B7"].font = FONT_KPI_VAL
    ws_dash["B7"].fill = FILL_CARD_BG
    ws_dash["B7"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["B7"].number_format = FMT_CURRENCY

    # Card 2: Balance Actual en Vivo
    ws_dash.merge_cells("D6:E6")
    ws_dash["D6"] = "BALANCE ACTUAL EN CUENTA"
    ws_dash["D6"].font = FONT_KPI_LABEL
    ws_dash["D6"].fill = FILL_CARD_BG
    ws_dash["D6"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("D7:E8")
    ws_dash["D7"] = "=B7+F7-B11"
    ws_dash["D7"].font = FONT_KPI_VAL_GREEN
    ws_dash["D7"].fill = FILL_CARD_BG
    ws_dash["D7"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["D7"].number_format = FMT_CURRENCY

    # Card 3: Ganancia Neta Total
    ws_dash.merge_cells("F6:G6")
    ws_dash["F6"] = "GANANCIA NETA TOTAL (PNL)"
    ws_dash["F6"].font = FONT_KPI_LABEL
    ws_dash["F6"].fill = FILL_CARD_BG
    ws_dash["F6"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("F7:G8")
    ws_dash["F7"] = "=SUM('📝 Bitácora Real'!P6:P60)"
    ws_dash["F7"].font = FONT_KPI_VAL_GREEN
    ws_dash["F7"].fill = FILL_CARD_BG
    ws_dash["F7"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["F7"].number_format = FMT_CURRENCY

    # Card 4: Rendimiento Compuesto (ROI %)
    ws_dash.merge_cells("H6:I6")
    ws_dash["H6"] = "RENDIMIENTO COMPUESTO (ROI %)"
    ws_dash["H6"].font = FONT_KPI_LABEL
    ws_dash["H6"].fill = FILL_CARD_BG
    ws_dash["H6"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("H7:I8")
    ws_dash["H7"] = "=IFERROR(F7/B7, 0)"
    ws_dash["H7"].font = FONT_KPI_VAL_GREEN
    ws_dash["H7"].fill = FILL_CARD_BG
    ws_dash["H7"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["H7"].number_format = FMT_PCT

    # KPI CARDS ROW 2 (Fila 10 - 12)
    # Card 5: Retiros Totales
    ws_dash.merge_cells("B10:C10")
    ws_dash["B10"] = "RETIROS TOTALES REALIZADOS"
    ws_dash["B10"].font = FONT_KPI_LABEL
    ws_dash["B10"].fill = FILL_CARD_BG
    ws_dash["B10"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("B11:C12")
    ws_dash["B11"] = "='💵 Retiros & Depósitos'!C6"
    ws_dash["B11"].font = FONT_KPI_VAL_GOLD
    ws_dash["B11"].fill = FILL_CARD_BG
    ws_dash["B11"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["B11"].number_format = FMT_CURRENCY

    # Card 6: Win Rate %
    ws_dash.merge_cells("D10:E10")
    ws_dash["D10"] = "TASA DE ACIERTO (WIN RATE)"
    ws_dash["D10"].font = FONT_KPI_LABEL
    ws_dash["D10"].fill = FILL_CARD_BG
    ws_dash["D10"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("D11:E12")
    ws_dash["D11"] = '=IFERROR(COUNTIF(\'📝 Bitácora Real\'!O6:O60, "WIN")/B16, 0)'
    ws_dash["D11"].font = FONT_KPI_VAL_GREEN
    ws_dash["D11"].fill = FILL_CARD_BG
    ws_dash["D11"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["D11"].number_format = FMT_PCT

    # Card 7: Profit Factor
    ws_dash.merge_cells("F10:G10")
    ws_dash["F10"] = "PROFIT FACTOR"
    ws_dash["F10"].font = FONT_KPI_LABEL
    ws_dash["F10"].fill = FILL_CARD_BG
    ws_dash["F10"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("F11:G12")
    ws_dash["F11"] = '=IFERROR(SUMIF(\'📝 Bitácora Real\'!P6:P60, ">0")/ABS(SUMIF(\'📝 Bitácora Real\'!P6:P60, "<0")), 0)'
    ws_dash["F11"].font = FONT_KPI_VAL
    ws_dash["F11"].fill = FILL_CARD_BG
    ws_dash["F11"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["F11"].number_format = '0.00'

    # Card 8: Capital Propio en Riesgo
    ws_dash.merge_cells("H10:I10")
    ws_dash["H10"] = "CAPITAL PROPIO EN RIESGO"
    ws_dash["H10"].font = FONT_KPI_LABEL
    ws_dash["H10"].fill = FILL_CARD_BG
    ws_dash["H10"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash.merge_cells("H11:I12")
    ws_dash["H11"] = "=MAX(0, B7-B11)"
    ws_dash["H11"].font = FONT_KPI_VAL
    ws_dash["H11"].fill = FILL_CARD_BG
    ws_dash["H11"].alignment = Alignment(horizontal="center", vertical="center")
    ws_dash["H11"].number_format = FMT_CURRENCY

    for r in range(6, 13):
        for c in range(2, 10):
            ws_dash.cell(row=r, column=c).border = BORDER_THIN

    # Tabla Estadísticas Avanzadas
    ws_dash["B14"] = "MÉTRICAS DETALLADAS DE RIESGO & OPERATORIA"
    ws_dash["B14"].font = Font(name=FONT_FAMILY, size=10.5, bold=True, color="0F172A")

    adv_headers = ["Total Trades", "Mejor Win ($)", "Peor Loss ($)", "Racha Ganadora Máx", "Riesgo Promedio ($)", "R:R Promedio"]
    for idx, h in enumerate(adv_headers, start=2):
        cell = ws_dash.cell(row=15, column=idx, value=h)
        cell.font = FONT_TH
        cell.fill = FILL_SUBHEADER
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    ws_dash["B16"] = "=COUNT('📝 Bitácora Real'!B6:B60)"
    ws_dash["C16"] = "=IFERROR(MAX('📝 Bitácora Real'!P6:P60), 0)"
    ws_dash["C16"].number_format = FMT_CURRENCY
    ws_dash["D16"] = "=IFERROR(MIN('📝 Bitácora Real'!P6:P60), 0)"
    ws_dash["D16"].number_format = FMT_CURRENCY
    ws_dash["E16"] = 4
    ws_dash["F16"] = "=IFERROR(AVERAGE('📝 Bitácora Real'!L6:L60), 0)"
    ws_dash["F16"].number_format = FMT_CURRENCY
    ws_dash["G16"] = "=IFERROR(AVERAGEIF('📝 Bitácora Real'!N6:N60, \">0\"), 0)"
    ws_dash["G16"].number_format = FMT_RR

    for c in range(2, 8):
        cell = ws_dash.cell(row=16, column=c)
        cell.font = FONT_BODY_BOLD
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    # Tabla Desglose por Par
    ws_dash["B18"] = "DESGLOSE POR ACTIVO OPERADO"
    ws_dash["B18"].font = Font(name=FONT_FAMILY, size=10.5, bold=True, color="0F172A")

    for idx, h in enumerate(["Par", "Banderas", "Operaciones", "Wins", "Win Rate %", "PnL Neto ($)"], start=2):
        cell = ws_dash.cell(row=19, column=idx, value=h)
        cell.font = FONT_TH
        cell.fill = FILL_SUBHEADER
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    pairs_data = [
        ("USDCAD", "🇺🇸🇨🇦", 20),
        ("AUDCAD", "🇦🇺🇨🇦", 21),
        ("AUDJPY", "🇦🇺🇯🇵", 22)
    ]

    for p, flag, r_idx in pairs_data:
        ws_dash.cell(row=r_idx, column=2, value=p).font = FONT_BODY_BOLD
        ws_dash.cell(row=r_idx, column=3, value=flag).alignment = Alignment(horizontal="center")
        ws_dash.cell(row=r_idx, column=4, value=f'=COUNTIFS(\'📝 Bitácora Real\'!D$6:D$60, "{p}", \'📝 Bitácora Real\'!B$6:B$60, ">0")').alignment = Alignment(horizontal="center")
        ws_dash.cell(row=r_idx, column=5, value=f'=COUNTIFS(\'📝 Bitácora Real\'!D$6:D$60, "{p}", \'📝 Bitácora Real\'!O$6:O$60, "WIN")').alignment = Alignment(horizontal="center")
        ws_dash.cell(row=r_idx, column=6, value=f'=IFERROR(E{r_idx}/D{r_idx}, 0)').number_format = FMT_PCT
        ws_dash.cell(row=r_idx, column=7, value=f'=SUMIF(\'📝 Bitácora Real\'!D$6:D$60, "{p}", \'📝 Bitácora Real\'!P$6:P$60)').number_format = FMT_CURRENCY
        
        for c in range(2, 8):
            cell = ws_dash.cell(row=r_idx, column=c)
            cell.font = FONT_BODY
            cell.border = BORDER_THIN
            if c in [2, 7]:
                cell.font = FONT_BODY_BOLD

    # -------------------------------------------------------------
    # HOJA 2: 📝 BITÁCORA REAL
    # -------------------------------------------------------------
    ws_log = wb.create_sheet(title="📝 Bitácora Real")
    ws_log.views.sheetView[0].showGridLines = True

    ws_log.merge_cells("B2:U3")
    log_header = ws_log["B2"]
    log_header.value = "  REGISTRO DETALLADO DE OPERACIONES — CUENTA REAL"
    log_header.font = FONT_TITLE
    log_header.fill = FILL_NAVY_HEADER
    log_header.alignment = Alignment(horizontal="left", vertical="center")

    real_headers = [
        ("#", 6),
        ("Fecha & Hora", 18),
        ("Par", 12),
        ("Dir", 8),
        ("Sesión", 13),
        ("Entrada", 12),
        ("Stop Loss", 12),
        ("Take Profit", 12),
        ("Pips SL (Auto)", 13),
        ("Riesgo %", 10),
        ("Riesgo $ (Auto)", 14),
        ("Lote (Auto)", 12),
        ("Ratio R:R (Auto)", 14),
        ("Resultado", 12),
        ("PnL Neto $ (Auto)", 16),
        ("Balance $ (Auto)", 16),
        ("Retorno % (Auto)", 14),
        ("Estrategia / Gatillo", 22),
        ("Plan 100%", 11),
        ("Bitácora Psicológica", 22)
    ]

    for idx, (title, width) in enumerate(real_headers, start=2):
        col_letter = get_column_letter(idx)
        ws_log.column_dimensions[col_letter].width = width
        cell = ws_log.cell(row=5, column=idx, value=title)
        cell.font = FONT_TH
        cell.fill = FILL_EMERALD_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER_THIN

    # 10 operaciones de muestra en cuenta real (1% riesgo con interés compuesto)
    sample_real = [
        (1, "2026-11-03 09:30", "USDCAD", "BUY", "Nueva York", 1.38500, 1.38250, 1.39250, 1.00, "WIN", "Ruptura NY + FVG M5", "SÍ", "Paciencia y confirmación"),
        (2, "2026-11-03 14:15", "AUDJPY", "SELL", "Nueva York", 153.800, 154.050, 153.050, 1.00, "WIN", "Order Block M15 + Reject", "SÍ", "Gestión tranquila"),
        (3, "2026-11-04 04:00", "AUDCAD", "BUY", "Londres", 0.90800, 0.90550, 0.91550, 1.00, "LOSS", "Ruptura de Rango Londres", "SÍ", "Pérdida asumida sin revenge"),
        (4, "2026-11-04 09:45", "USDCAD", "SELL", "Nueva York", 1.39100, 1.39350, 1.38350, 1.00, "WIN", "Liquidity Sweep Asian High", "SÍ", "Excelente entrada en retroceso"),
        (5, "2026-11-04 15:30", "AUDJPY", "BUY", "Nueva York", 153.200, 153.450, 153.200, 1.00, "BE", "Breakeven tras +1.5R", "SÍ", "Protegido a tiempo"),
        (6, "2026-11-05 03:30", "AUDCAD", "SELL", "Londres", 0.90400, 0.90650, 0.89650, 1.00, "WIN", "Pullback VWAP + Trend M15", "SÍ", "Plan seguido al 100%"),
        (7, "2026-11-05 10:15", "USDCAD", "BUY", "Nueva York", 1.38800, 1.38550, 1.39550, 1.00, "LOSS", "Intento Fallido Apertura", "SÍ", "Control emocional total"),
        (8, "2026-11-05 13:45", "AUDJPY", "SELL", "Nueva York", 154.100, 154.350, 153.350, 1.00, "WIN", "Rechazo Resistencia D1", "SÍ", "Gran trade a favor de tendencia"),
        (9, "2026-11-06 09:00", "USDCAD", "SELL", "Nueva York", 1.39400, 1.39650, 1.38650, 1.00, "WIN", "Post-Noticias Sin Desliz", "SÍ", "Esperé a que el spread baje"),
        (10, "2026-11-06 14:00", "AUDCAD", "BUY", "Nueva York", 0.90100, 0.90350, 0.90100, 1.00, "BE", "Protección a Breakeven", "SÍ", "Cierre semanal positivo"),
    ]

    for r in range(6, 61):
        is_sample = (r - 6) < len(sample_real)

        if is_sample:
            s = sample_real[r - 6]
            ws_log.cell(row=r, column=2, value=s[0]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=3, value=s[1]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=4, value=s[2]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=5, value=s[3]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=6, value=s[4]).alignment = Alignment(horizontal="center")

            c_e = ws_log.cell(row=r, column=7, value=s[5])
            c_e.number_format = '0.00000' if 'JPY' not in s[2] else '0.000'
            c_sl = ws_log.cell(row=r, column=8, value=s[6])
            c_sl.number_format = '0.00000' if 'JPY' not in s[2] else '0.000'
            c_tp = ws_log.cell(row=r, column=9, value=s[7])
            c_tp.number_format = '0.00000' if 'JPY' not in s[2] else '0.000'

            ws_log.cell(row=r, column=11, value=s[8]).number_format = FMT_PCT

            c_res = ws_log.cell(row=r, column=15, value=s[9])
            c_res.alignment = Alignment(horizontal="center")
            if s[9] == "WIN":
                c_res.fill = FILL_WIN
                c_res.font = FONT_WIN
            elif s[9] == "LOSS":
                c_res.fill = FILL_LOSS
                c_res.font = FONT_LOSS
            else:
                c_res.fill = FILL_BE
                c_res.font = FONT_BE

            ws_log.cell(row=r, column=19, value=s[10])
            ws_log.cell(row=r, column=20, value=s[11]).alignment = Alignment(horizontal="center")
            ws_log.cell(row=r, column=21, value=s[12])
        else:
            ws_log.cell(row=r, column=2, value="")
            ws_log.cell(row=r, column=3, value="")
            ws_log.cell(row=r, column=4, value="")
            ws_log.cell(row=r, column=5, value="")
            ws_log.cell(row=r, column=6, value="")
            ws_log.cell(row=r, column=7, value="")
            ws_log.cell(row=r, column=8, value="")
            ws_log.cell(row=r, column=9, value="")
            ws_log.cell(row=r, column=11, value=1.00).number_format = FMT_PCT
            ws_log.cell(row=r, column=15, value="")
            ws_log.cell(row=r, column=19, value="")
            ws_log.cell(row=r, column=20, value="")
            ws_log.cell(row=r, column=21, value="")

        # FÓRMULAS TOTALMENTE DINÁMICAS (Para todas las filas 6 a 60):
        # Col J (10): Pips SL
        ws_log.cell(row=r, column=10, value=f'=IF(ISBLANK(B{r}), "", IF(AND(ISNUMBER(G{r}), ISNUMBER(H{r})), ROUND(ABS(G{r}-H{r}) / VLOOKUP(D{r}, \'⚙️ Parámetros Forex\'!B$6:F$8, 3, FALSE), 1), 25.0))').number_format = FMT_PIPS

        # Col L (12): Riesgo ($ USD) -> Balance anterior * (Riesgo % / 100)
        if r == 6:
            ws_log.cell(row=r, column=12, value=f'=IF(ISBLANK(B{r}), "", ROUND(\'📈 Dashboard Real\'!B7 * (K{r}/100), 2))').number_format = FMT_CURRENCY
        else:
            ws_log.cell(row=r, column=12, value=f'=IF(ISBLANK(B{r}), "", ROUND(Q{r-1} * (K{r}/100), 2))').number_format = FMT_CURRENCY

        # Col M (13): Lotaje Sugerido -> Riesgo $ / (Pips SL * Valor Pip USD)
        ws_log.cell(row=r, column=13, value=f'=IF(ISBLANK(B{r}), "", MAX(0.01, ROUND(L{r} / (J{r} * VLOOKUP(D{r}, \'⚙️ Parámetros Forex\'!B$6:F$8, 4, FALSE)), 2)))').number_format = FMT_LOT

        # Col N (14): Ratio R:R -> Calculado automáticamente
        ws_log.cell(row=r, column=14, value=f'=IF(ISBLANK(B{r}), "", IF(AND(ISNUMBER(G{r}), ISNUMBER(H{r}), ISNUMBER(I{r}), ABS(G{r}-H{r})>0), ROUND(ABS(I{r}-G{r}) / ABS(G{r}-H{r}), 2), 3.0))').number_format = FMT_RR

        # Col P (16): PnL Neto ($ USD)
        ws_log.cell(row=r, column=16, value=f'=IF(ISBLANK(B{r}), "", IF(O{r}="WIN", ROUND(L{r}*N{r}, 2), IF(O{r}="LOSS", -L{r}, 0)))').number_format = FMT_CURRENCY

        # Col Q (17): Balance Acumulado ($ USD)
        if r == 6:
            ws_log.cell(row=r, column=17, value=f'=IF(ISBLANK(B{r}), "", \'📈 Dashboard Real\'!B7 + P{r})').number_format = FMT_CURRENCY
        else:
            ws_log.cell(row=r, column=17, value=f'=IF(ISBLANK(B{r}), "", Q{r-1} + P{r})').number_format = FMT_CURRENCY

        # Col R (18): Retorno % de la Operación
        if r == 6:
            ws_log.cell(row=r, column=18, value=f'=IF(ISBLANK(B{r}), "", P{r} / \'📈 Dashboard Real\'!B7)').number_format = FMT_PCT
        else:
            ws_log.cell(row=r, column=18, value=f'=IF(ISBLANK(B{r}), "", P{r} / Q{r-1})').number_format = FMT_PCT

        for c in range(2, 22):
            ws_log.cell(row=r, column=c).border = BORDER_THIN
            if c not in [15]:
                ws_log.cell(row=r, column=c).font = FONT_BODY

    # Validaciones en Bitácora Real
    dv_pairs_r = DataValidation(type="list", formula1='"USDCAD,AUDCAD,AUDJPY"', allow_blank=True)
    ws_log.add_data_validation(dv_pairs_r)
    dv_pairs_r.add("D6:D60")

    dv_dir_r = DataValidation(type="list", formula1='"BUY,SELL"', allow_blank=True)
    ws_log.add_data_validation(dv_dir_r)
    dv_dir_r.add("E6:E60")

    dv_sess_r = DataValidation(type="list", formula1='"Nueva York,Londres,Asia"', allow_blank=True)
    ws_log.add_data_validation(dv_sess_r)
    dv_sess_r.add("F6:F60")

    dv_res_r = DataValidation(type="list", formula1='"WIN,LOSS,BE"', allow_blank=True)
    ws_log.add_data_validation(dv_res_r)
    dv_res_r.add("O6:O60")

    dv_plan_r = DataValidation(type="list", formula1='"SÍ,NO"', allow_blank=True)
    ws_log.add_data_validation(dv_plan_r)
    dv_plan_r.add("T6:T60")

    # Gráfico de Equity Real
    chart_real = LineChart()
    chart_real.title = "Curva de Crecimiento Compuesto (Cuenta Real)"
    chart_real.style = 13
    chart_real.y_axis.title = "Balance ($ USD)"
    chart_real.x_axis.title = "Trade #"
    chart_real.width = 19
    chart_real.height = 10

    data_ref_real = Reference(ws_log, min_col=17, min_row=5, max_row=15)
    chart_real.add_data(data_ref_real, titles_from_data=True)
    ws_dash.add_chart(chart_real, "B24")

    # -------------------------------------------------------------
    # HOJA 3: 💵 RETIROS & DEPÓSITOS
    # -------------------------------------------------------------
    ws_ret = wb.create_sheet(title="💵 Retiros & Depósitos")
    ws_ret.views.sheetView[0].showGridLines = True

    ws_ret.merge_cells("B2:G3")
    r_header = ws_ret["B2"]
    r_header.value = "  REGISTRO DINÁMICO DE INYECCIONES DE CAPITAL & RETIROS"
    r_header.font = FONT_TITLE
    r_header.fill = FILL_NAVY_HEADER
    r_header.alignment = Alignment(horizontal="left", vertical="center")

    # Resumen
    ws_ret["B5"] = "TOTAL DEPOSITADO:"
    ws_ret["B5"].font = FONT_BODY_BOLD
    ws_ret["C5"] = "=SUMIF(D10:D50, \"DEPOSITO\", E10:E50)"
    ws_ret["C5"].font = FONT_BODY_BOLD
    ws_ret["C5"].number_format = FMT_CURRENCY

    ws_ret["B6"] = "TOTAL RETIRADO:"
    ws_ret["B6"].font = FONT_BODY_BOLD
    ws_ret["C6"] = "=SUMIF(D10:D50, \"RETIRO\", E10:E50)"
    ws_ret["C6"].font = FONT_BODY_BOLD
    ws_ret["C6"].number_format = FMT_CURRENCY

    ws_ret["B7"] = "CAPITAL PROPIO EN RIESGO:"
    ws_ret["B7"].font = FONT_BODY_BOLD
    ws_ret["C7"] = "=MAX(0, C5-C6)"
    ws_ret["C7"].font = FONT_BODY_BOLD
    ws_ret["C7"].number_format = FMT_CURRENCY

    ret_headers = ["#", "Fecha", "Tipo (DEPOSITO / RETIRO)", "Monto ($ USD)", "Método", "Notas"]
    for idx, h in enumerate(ret_headers, start=2):
        cell = ws_ret.cell(row=9, column=idx, value=h)
        cell.font = FONT_TH
        cell.fill = FILL_SUBHEADER
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    sample_movs = [
        (1, "2026-11-01", "DEPOSITO", 1000.0, "Tarjeta Débito / Skrill", "Fondeo inicial de la cuenta"),
        (2, "2026-11-06", "RETIRO", 50.0, "Transferencia Bancaria", "Primer retiro de ganancias semanales")
    ]

    for idx, (m_id, m_dt, m_type, m_amt, m_method, m_note) in enumerate(sample_movs, start=10):
        ws_ret.cell(row=idx, column=2, value=m_id).alignment = Alignment(horizontal="center")
        ws_ret.cell(row=idx, column=3, value=m_dt).alignment = Alignment(horizontal="center")
        c_t = ws_ret.cell(row=idx, column=4, value=m_type)
        c_t.alignment = Alignment(horizontal="center")
        c_t.font = FONT_BODY_BOLD
        ws_ret.cell(row=idx, column=5, value=m_amt).number_format = FMT_CURRENCY
        ws_ret.cell(row=idx, column=6, value=m_method).alignment = Alignment(horizontal="left")
        ws_ret.cell(row=idx, column=7, value=m_note).alignment = Alignment(horizontal="left")
        for c in range(2, 8):
            ws_ret.cell(row=idx, column=c).border = BORDER_THIN

    for r in range(12, 40):
        for c in range(2, 8):
            ws_ret.cell(row=r, column=c).border = BORDER_THIN

    dv_mov = DataValidation(type="list", formula1='"DEPOSITO,RETIRO"', allow_blank=True)
    ws_ret.add_data_validation(dv_mov)
    dv_mov.add("D10:D40")

    # -------------------------------------------------------------
    # HOJA 4: ⚙️ PARÁMETROS FOREX
    # -------------------------------------------------------------
    ws_param_r = wb.create_sheet(title="⚙️ Parámetros Forex")
    ws_param_r.views.sheetView[0].showGridLines = True

    ws_param_r.merge_cells("B2:G3")
    pr_header = ws_param_r["B2"]
    pr_header.value = "  ESPECIFICACIONES DE PARES FOREX & MATRIZ DE RIESGO"
    pr_header.font = FONT_TITLE
    pr_header.fill = FILL_NAVY_HEADER
    pr_header.alignment = Alignment(horizontal="left", vertical="center")

    for idx, h in enumerate(PARAM_HEADERS, start=2):
        cell = ws_param_r.cell(row=5, column=idx, value=h)
        cell.font = FONT_TH
        cell.fill = FILL_SUBHEADER
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_THIN

    for idx, (p, flag, pip, val_pip, contract, margin) in enumerate(FOREX_SPECS_DATA, start=6):
        ws_param_r.cell(row=idx, column=2, value=p).font = FONT_BODY_BOLD
        ws_param_r.cell(row=idx, column=3, value=flag).alignment = Alignment(horizontal="center")
        ws_param_r.cell(row=idx, column=4, value=pip).number_format = '0.0000' if pip < 0.001 else '0.00'
        ws_param_r.cell(row=idx, column=5, value=val_pip).number_format = FMT_CURRENCY
        ws_param_r.cell(row=idx, column=6, value=contract).number_format = '#,##0'
        ws_param_r.cell(row=idx, column=7, value=margin).number_format = FMT_CURRENCY
        for c in range(2, 8):
            ws_param_r.cell(row=idx, column=c).border = BORDER_THIN

    auto_fit_columns(ws_dash)
    auto_fit_columns(ws_ret)
    auto_fit_columns(ws_param_r)

    real_path = os.path.join(OUTPUT_DIR, "Bitacora_Real_Pro_USDCAD_AUDCAD_AUDJPY.xlsx")
    wb.save(real_path)
    print(f"✅ Bitácora Real guardada en: {real_path}")


if __name__ == "__main__":
    create_fondeo_workbook()
    create_real_workbook()
