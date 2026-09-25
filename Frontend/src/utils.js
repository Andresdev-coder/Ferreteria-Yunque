export const money = (n) => '$ ' + Number(n || 0).toLocaleString('es-CO');

export const fecha = (d) =>
  new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
