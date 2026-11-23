/*
  CONFIGURACIÓN DE LA TIENDA VAKU
  ---------------------------------
  Casi todo se maneja desde la planilla de Google (productos, precios,
  códigos, WhatsApp, promos). Acá solo va el ID de esa planilla.

  El ID es la parte larga del link de la planilla:
  https://docs.google.com/spreadsheets/d/  ESTE-ES-EL-ID  /edit
*/
window.VAKU_CONFIG = {
  sheetId: "1qhi6UqH1EpyF0bSYNKZ1K0ninEc5SedbVV6WtYGiUlI",

  // Nombres de las pestañas de la planilla (no cambiar salvo que las renombres)
  tabs: {
    productos: "Productos",
    codigos: "Codigos",
    ajustes: "Ajustes",
  },
};
