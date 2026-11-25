import { Injectable, inject } from '@angular/core';
import { supabase } from './supabaseClient';
import { LogsService } from './logs.service';

export interface FiltroFechas {
  desde?: string; // ISO o YYYY-MM-DD
  hasta?: string; // ISO o YYYY-MM-DD
}

export interface ResumenFacturacion {
  totalFacturado: number;
  cantidadOrdenes: number;
  porMetodoPago: { metodo: string; total: number; cantidad: number }[];
  ordenes: any[];
}

export interface PeliculaVistaPeriodo {
  periodo: string; // ej. "2026-W47" o "2026-11"
  etiquetaPeriodo: string;
  peliculaId: string;
  peliculaNombre: string;
  vistas: number;
}

export interface ProductoCandyVendido {
  nombre: string;
  cantidadVendida: number;
  recaudacionEstimada: number;
}

export interface ReporteCandyBar {
  productoMasVendido: ProductoCandyVendido | null;
  ranking: ProductoCandyVendido[];
}

@Injectable({
  providedIn: 'root',
})
export class ReportesService {
  private logsService = inject(LogsService);
  /**
   * 1. Reporte de facturación desde la tabla `ordenes`
   */
  async getReporteFacturacion(filtro?: FiltroFechas): Promise<ResumenFacturacion> {
    let query = supabase
      .from('ordenes')
      .select('*')
      .in('estado', ['pagado', 'aprobado'])
      .order('created_at', { ascending: false });

    if (filtro?.desde) {
      query = query.gte('created_at', new Date(filtro.desde).toISOString());
    }
    if (filtro?.hasta) {
      const fin = new Date(filtro.hasta);
      fin.setHours(23, 59, 59, 999);
      query = query.lte('created_at', fin.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Error al obtener reporte de facturación: ${error.message}`);
    }

    const ordenes = data || [];
    let totalFacturado = 0;
    const mapaMetodos = new Map<string, { metodo: string; total: number; cantidad: number }>();

    for (const orden of ordenes) {
      const monto = Number(orden.total) || 0;
      totalFacturado += monto;

      const metodo = (orden.metodo_pago || 'sin_especificar').toLowerCase();
      const actual = mapaMetodos.get(metodo) || { metodo, total: 0, cantidad: 0 };
      actual.total += monto;
      actual.cantidad += 1;
      mapaMetodos.set(metodo, actual);
    }

    return {
      totalFacturado,
      cantidadOrdenes: ordenes.length,
      porMetodoPago: Array.from(mapaMetodos.values()).sort((a, b) => b.total - a.total),
      ordenes,
    };
  }

  /**
   * 2. Películas más vistas por 'semana' o 'mes'.
   * Regla: Solo cuenta si la entrada tiene estado === 'retirado'.
   */
  async getPeliculasMasVistas(
    agrupacion: 'semana' | 'mes' = 'semana',
    filtro?: FiltroFechas,
  ): Promise<PeliculaVistaPeriodo[]> {
    const { data, error } = await supabase
      .from('entradas')
      .select(`
        id,
        estado,
        retirado_en,
        created_at,
        funciones (
          id,
          fecha_inicio,
          pelicula_id,
          peliculas (
            id,
            nombre
          )
        )
      `)
      .eq('estado', 'retirado');

    if (error) {
      throw new Error(`Error al obtener películas vistas: ${error.message}`);
    }

    const entradasRetiradas = data || [];
    const mapa = new Map<string, PeliculaVistaPeriodo>();

    for (const entrada of entradasRetiradas) {
      const funcion = Array.isArray((entrada as any).funciones)
        ? (entrada as any).funciones[0]
        : (entrada as any).funciones;

      if (!funcion) continue;

      const pelicula = Array.isArray(funcion.peliculas)
        ? funcion.peliculas[0]
        : funcion.peliculas;

      const fechaRefStr = entrada.retirado_en || funcion.fecha_inicio || entrada.created_at;
      const fechaRef = new Date(fechaRefStr);
      if (isNaN(fechaRef.getTime())) continue;

      if (filtro?.desde && fechaRef < new Date(filtro.desde)) continue;
      if (filtro?.hasta) {
        const fin = new Date(filtro.hasta);
        fin.setHours(23, 59, 59, 999);
        if (fechaRef > fin) continue;
      }

      const { clave, etiqueta } =
        agrupacion === 'mes' ? this.obtenerClaveMes(fechaRef) : this.obtenerClaveSemana(fechaRef);

      const peliculaId = pelicula?.id || funcion.pelicula_id || 'desconocida';
      const peliculaNombre = pelicula?.nombre || 'Película sin nombre';
      const key = `${clave}__${peliculaId}`;

      const existente = mapa.get(key);
      if (existente) {
        existente.vistas += 1;
      } else {
        mapa.set(key, {
          periodo: clave,
          etiquetaPeriodo: etiqueta,
          peliculaId,
          peliculaNombre,
          vistas: 1,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) => {
      if (a.periodo !== b.periodo) return a.periodo.localeCompare(b.periodo);
      return b.vistas - a.vistas;
    });
  }

  /**
   * 3. Producto del Candy Bar más vendido
   */
  async getProductoCandyMasVendido(filtro?: FiltroFechas): Promise<ReporteCandyBar> {
    // A) Productos físicos marcados como 'vendido' (al aprobar/retirar orden)
    let prodQuery = supabase
      .from('productos')
      .select('id, nombre, precio_dinero, orden_id, created_at')
      .eq('estado', 'vendido');

    if (filtro?.desde) {
      prodQuery = prodQuery.gte('created_at', new Date(filtro.desde).toISOString());
    }
    if (filtro?.hasta) {
      const fin = new Date(filtro.hasta);
      fin.setHours(23, 59, 59, 999);
      prodQuery = prodQuery.lte('created_at', fin.toISOString());
    }

    const { data: productosVendidos, error: errorProd } = await prodQuery;
    if (errorProd) {
      throw new Error(`Error al consultar productos vendidos: ${errorProd.message}`);
    }

    const mapaProductos = new Map<string, ProductoCandyVendido>();
    const ordenesConProductosFisicos = new Set<string>();

    for (const prod of productosVendidos || []) {
      if (prod.orden_id) {
        ordenesConProductosFisicos.add(String(prod.orden_id));
      }
      const nombre = prod.nombre || 'Producto sin nombre';
      const precio = Number(prod.precio_dinero) || 0;
      const actual = mapaProductos.get(nombre) || {
        nombre,
        cantidadVendida: 0,
        recaudacionEstimada: 0,
      };
      actual.cantidadVendida += 1;
      actual.recaudacionEstimada += precio;
      mapaProductos.set(nombre, actual);
    }

    // B) Respaldo desde `ordenes.items_candy` en órdenes aprobadas que no tengan filas físicas ya sumadas
    let ordenesQuery = supabase
      .from('ordenes')
      .select('id, items_candy, created_at')
      .eq('estado', 'aprobado')
      .not('items_candy', 'is', null);

    if (filtro?.desde) {
      ordenesQuery = ordenesQuery.gte('created_at', new Date(filtro.desde).toISOString());
    }
    if (filtro?.hasta) {
      const fin = new Date(filtro.hasta);
      fin.setHours(23, 59, 59, 999);
      ordenesQuery = ordenesQuery.lte('created_at', fin.toISOString());
    }

    const { data: ordenesCandy, error: errorOrdenes } = await ordenesQuery;
    if (errorOrdenes) {
      throw new Error(`Error al consultar items_candy en órdenes: ${errorOrdenes.message}`);
    }

    for (const orden of ordenesCandy || []) {
      if (ordenesConProductosFisicos.has(String(orden.id))) continue;
      if (!Array.isArray(orden.items_candy)) continue;

      for (const item of orden.items_candy) {
        const nombre = item?.nombre || 'Producto Candy';
        const cantidad = Number(item?.cantidad) || 1;
        const precioUnit = Number(item?.precio ?? item?.precio_dinero) || 0;

        const actual = mapaProductos.get(nombre) || {
          nombre,
          cantidadVendida: 0,
          recaudacionEstimada: 0,
        };
        actual.cantidadVendida += cantidad;
        actual.recaudacionEstimada += cantidad * precioUnit;
        mapaProductos.set(nombre, actual);
      }
    }

    const ranking = Array.from(mapaProductos.values()).sort(
      (a, b) => b.cantidadVendida - a.cantidadVendida,
    );

    return {
      productoMasVendido: ranking.length > 0 ? ranking[0] : null,
      ranking,
    };
  }

  /**
   * 4. Log de actividad para el panel de admin
   */
  async getLogActividad(limite: number = 100): Promise<any[]> {
    return this.logsService.obtenerLogs(limite);
  }

  private obtenerClaveMes(fecha: Date): { clave: string; etiqueta: string } {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const etiqueta = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return { clave: `${anio}-${mes}`, etiqueta };
  }

  private obtenerClaveSemana(fecha: Date): { clave: string; etiqueta: string } {
    const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const semanaStr = String(weekNo).padStart(2, '0');

    // Lunes de esa semana para etiqueta amigable
    const lunes = new Date(d);
    lunes.setUTCDate(d.getUTCDate() - (d.getUTCDay() || 7) + 1);
    const etiqueta = `Sem ${semanaStr} (desde ${lunes.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    })})`;

    return { clave: `${d.getUTCFullYear()}-W${semanaStr}`, etiqueta };
  }
}