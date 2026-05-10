"""
Reconnaissance map for MIDAGRI / GMML / EMMSA public data (verify URLs periodically).

SISAP is a web application; official bulk JSON is not documented publicly.
Prefer: DevTools Network inspection when building dedicated scrapers.
"""

# Primary SISAP entry (Lima wholesale + national city modules).
SISAP_PORTAL = "https://sistemas.midagri.gob.pe/sisap/portal/"

# Alternate wholesale UI referenced on gob.pe service pages (verify in browser).
SISAP_PORTAL2_MAYORISTA = "https://sistemas.midagri.gob.pe/sisap/portal2/mayorista/"

# MIDAGRI institution hub (precios de alimentos, boletines, informes).
MIDAGRI_GOBPE_INSTITUTION = "https://www.gob.pe/institucion/midagri"

# Examples of recurring publication types (IDs may rotate; use hub search in production).
GOBPE_DAILY_FOOD_PRICES_BULLETIN = (
    "https://www.gob.pe/institucion/midagri/informes-publicaciones/"
    "1211-boletin-de-precios-diarios-de-alimentos"
)
GOBPE_WHOLESALE_INGRESS_REPORTS = (
    "https://www.gob.pe/institucion/midagri/informes-publicaciones"
    "?term=mercado+mayorista+de+productores"
)

# EMMSA (Gran Mercado Mayorista de Lima operator) — confirm stable open series.
EMMSA_HOME = "https://www.emmsa.gob.pe/"

RECON_NOTES = """
Hackathon MVP notes:
- SISAPLIMA: GMML, Mercado Mayorista Frutas N2, Modelo de Frutas, Cooperativo Túpac Amaru, Santa Anita productores.
- SISAP Precios de Ciudades: wholesale/retail across ~27 cities.
- Supplement EMMSA only after locating a durable public CSV/HTML table endpoint.
"""
