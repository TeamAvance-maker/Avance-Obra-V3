export type HelpQA = { q: string; a: string };
export type HelpSection = {
  id: string;
  emoji: string;
  title: string;
  intro: string;
  qa: HelpQA[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "inicio",
    emoji: "🏠",
    title: "Inicio",
    intro: "Es la pantalla principal con un resumen rápido del estado de la obra.",
    qa: [
      {
        q: "¿Qué veo en Inicio?",
        a: "Un resumen general: cantidad de sitios, avance, materiales recibidos y entregados. Es la primera mirada del día.",
      },
      {
        q: "¿Puedo cambiar lo que muestra?",
        a: "No directamente. La información se actualiza sola cuando registras recepciones, entregas o cambios de etapa.",
      },
    ],
  },
  {
    id: "plano",
    emoji: "🗺️",
    title: "Plano",
    intro: "Vista visual de todos los sitios de la obra y su etapa de avance.",
    qa: [
      {
        q: "¿Cómo busco un sitio o vale tipo?",
        a: "Usa la barra de búsqueda arriba del plano. Puedes escribir el nombre del sitio, tipo de casa o etapa.",
      },
      {
        q: "¿Para qué sirven las etiquetas Terminados / En Ejecución / Sin Iniciar?",
        a: "Son filtros rápidos. Haz clic una vez para filtrar; haz clic otra vez para quitar el filtro.",
      },
      {
        q: "¿Cómo cambio la etapa de un sitio?",
        a: "Haz clic sobre el sitio en el plano y elige la nueva etapa en el menú que aparece.",
      },
      {
        q: "¿Qué significan los colores?",
        a: "Cada color representa una etapa distinta (sin iniciar, en ejecución, terminado). Te ayuda a ver el avance de un vistazo.",
      },
    ],
  },
  {
    id: "materiales",
    emoji: "📦",
    title: "Materiales",
    intro: "Catálogo de todos los materiales que se usan en la obra.",
    qa: [
      {
        q: "¿Cómo agrego un material nuevo?",
        a: "Pulsa el botón 'Agregar material', escribe el nombre, elige la unidad (unidades, metros, kilos, etc.) y guarda.",
      },
      {
        q: "¿Qué es el 'vale tipo'?",
        a: "Es la cantidad estándar de un material que se entrega por cada tipo de casa. Te ayuda a saber cuánto debes entregar sin calcular cada vez.",
      },
      {
        q: "¿Puedo editar o eliminar un material?",
        a: "Sí. Haz clic en la fila del material para editarlo. Para eliminar, usa el botón de borrar (te pedirá confirmación porque borra en cascada todo lo relacionado).",
      },
      {
        q: "¿Qué pasa si elimino un material con recepciones registradas?",
        a: "Verás una ventana que te muestra todo lo que se va a eliminar también (recepciones, entregas, vales). Es irreversible.",
      },
    ],
  },
  {
    id: "recepciones",
    emoji: "📥",
    title: "Recepciones",
    intro: "Registra el material que llega a la bodega de obra.",
    qa: [
      {
        q: "¿Cómo registro una recepción?",
        a: "Pulsa 'Nueva recepción', elige el material, la fecha y la cantidad. Guarda y queda registrado.",
      },
      {
        q: "La fecha me toma un día antes, ¿por qué?",
        a: "Eso ya está corregido. Ahora la fecha que eliges es exactamente la que se guarda, sin importar la zona horaria.",
      },
      {
        q: "¿Cómo veo solo 10, 50 o 100 registros?",
        a: "Abajo de la tabla hay un selector de cantidad por página. También puedes elegir 'Todos' para verlos sin paginar.",
      },
      {
        q: "¿Puedo ordenar la tabla por columna?",
        a: "Sí. Haz clic en el título de la columna (fecha, material, cantidad) para ordenar ascendente o descendente.",
      },
    ],
  },
  {
    id: "entregas",
    emoji: "🚚",
    title: "Entregas",
    intro: "Registra el material que sale de bodega hacia cada sitio.",
    qa: [
      {
        q: "¿Cómo entrego material a un sitio?",
        a: "Elige el sitio, la etapa, y agrega los materiales con su cantidad. Guarda para registrar la entrega.",
      },
      {
        q: "¿Dónde veo lo que ya entregué?",
        a: "Más abajo en la misma pantalla está la sección 'Historial de entregas por sitio', donde puedes ver el detalle por vale y sitio.",
      },
      {
        q: "¿Qué pasa si entrego más de lo que hay en bodega?",
        a: "El sistema te avisa y el inventario quedará en negativo. Revisa las recepciones antes de entregar.",
      },
    ],
  },
  {
    id: "casas",
    emoji: "🏘️",
    title: "Casas",
    intro: "Define los tipos de casa y asigna sitios a cada tipo.",
    qa: [
      {
        q: "¿Qué es un 'tipo de casa'?",
        a: "Es un modelo de vivienda (ej. Tipo A, Tipo B). Cada tipo tiene su propio vale tipo de materiales.",
      },
      {
        q: "¿Cómo asigno un tipo a un sitio?",
        a: "En la pantalla de sitios o desde el plano, edita el sitio y elige el tipo de casa correspondiente.",
      },
    ],
  },
  {
    id: "inventario",
    emoji: "📋",
    title: "Inventario",
    intro: "Stock actual de cada material en bodega.",
    qa: [
      {
        q: "¿Cómo se calcula el stock?",
        a: "Es la suma de todas las recepciones menos todas las entregas a sitios. Se actualiza automáticamente.",
      },
      {
        q: "¿Por qué un material aparece en rojo o negativo?",
        a: "Significa que se entregó más de lo recibido. Registra las recepciones que falten o revisa las entregas.",
      },
    ],
  },
  {
    id: "reportes",
    emoji: "📊",
    title: "Reportes",
    intro: "Vista consolidada con filtros tipo Excel y exportación.",
    qa: [
      {
        q: "¿Cómo filtro como en Excel?",
        a: "Cada columna tiene una fila de filtro. En texto puedes escribir; en números puedes usar =, >, <, >=, <=, <> para comparar.",
      },
      {
        q: "¿Cómo ordeno A-Z o Z-A?",
        a: "Haz clic en el título de la columna. Una flecha indicará el orden actual.",
      },
      {
        q: "¿Puedo exportar a Excel o PDF?",
        a: "Sí. Los botones de exportar (Excel, CSV, PDF) respetan los filtros activos en pantalla.",
      },
      {
        q: "¿Cómo limpio todos los filtros?",
        a: "Usa el botón 'Limpiar filtros' arriba de la tabla.",
      },
    ],
  },
  {
    id: "config",
    emoji: "⚙️",
    title: "Configuración",
    intro: "Datos de la obra, respaldo, restauración e inicialización del sistema.",
    qa: [
      {
        q: "¿Cómo hago un respaldo de todo?",
        a: "En Configuración > Respaldo, pulsa 'Descargar respaldo completo'. Guarda el archivo en lugar seguro (pendrive o nube).",
      },
      {
        q: "¿Puedo restaurar solo una parte?",
        a: "Sí. Al subir el archivo de respaldo, puedes elegir qué tablas restaurar (materiales, recepciones, etc.).",
      },
      {
        q: "¿Qué es la bitácora de eliminaciones?",
        a: "Un registro histórico de todo lo que se borró del sistema, con fecha, hora y usuario. No se puede borrar — es solo para consulta.",
      },
      {
        q: "¿Qué hace 'Inicializar sistema'?",
        a: "Deja la base de datos completamente vacía (como recién instalada). Solo el superadmin puede hacerlo, con contraseña. Es irreversible: haz respaldo antes.",
      },
      {
        q: "¿Quién es el superadmin?",
        a: "Por ahora hay un único superadmin protegido por contraseña de obra. Más adelante habrá gestión de usuarios.",
      },
    ],
  },
];
