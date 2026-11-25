import { Injectable,inject } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase
import { LogsService } from './logs.service';
import { PeliculasService } from './peliculas';

@Injectable({
  providedIn: 'root',
})
export class EntradasService {
  private logsService = inject(LogsService);
  private peliculasService = inject(PeliculasService);

  /**
   * Genera un código aleatorio limpio de 7 letras mayúsculas
   */
  private generarCodigoRetiro(): string {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let codigo = '';
    for (let i = 0; i < 7; i++) {
      codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
  }

  /**
   * Obtiene todas las entradas existentes para una función específica
   */
  async getEntradasPorFuncion(funcionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('entradas')
      .select('*')
      .eq('funcion_id', funcionId)
      .neq('estado', 'disponible');

    if (error) {
      throw new Error(`Error al cargar los asientos: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Bloquea un asiento inmediatamente al hacer clic (Acepta string o null para usuarioId)
   */
  async bloquearAsiento(
    funcionId: string,
    usuarioId: string | null,
    fila: string,
    numeroAsiento: number,
  ): Promise<any> {
    const { data: existente, error: errorConsulta } = await supabase
      .from('entradas')
      .select('*')
      .eq('funcion_id', funcionId)
      .eq('fila', fila)
      .eq('numero_asiento', numeroAsiento)
      .maybeSingle();

    if (errorConsulta) {
      throw new Error(`Error al verificar el asiento: ${errorConsulta.message}`);
    }

    if (existente) {
      if (existente.estado !== 'disponible') {
        throw new Error('Este asiento acaba de ser seleccionado o comprado por otro usuario.');
      }

      const { data: actualizada, error: errorUpdate } = await supabase
        .from('entradas')
        .update({
          usuario_id: usuarioId,
          estado: 'seleccionado',
          aprobada: false,
          orden_id: null,
        })
        .eq('id', existente.id)
        .eq('estado', 'disponible')
        .select();

      if (errorUpdate) {
        throw new Error(`No se pudo seleccionar el asiento: ${errorUpdate.message}`);
      }

      return actualizada && actualizada.length > 0 ? actualizada[0] : null;
    }

    const { data, error } = await supabase
      .from('entradas')
      .insert([
        {
          funcion_id: funcionId,
          usuario_id: usuarioId,
          fila: fila,
          numero_asiento: numeroAsiento,
          estado: 'seleccionado',
          aprobada: false,
        },
      ])
      .select();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este asiento acaba de ser seleccionado por otro usuario.');
      }
      throw new Error(`No se pudo seleccionar el asiento: ${error.message}`);
    }

    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Libera/Borra el asiento si el usuario lo deselecciona o cancela
   */
  async liberarAsiento(entradaId: string): Promise<void> {
    const { error } = await supabase.from('entradas').delete().eq('id', entradaId);

    if (error) {
      throw new Error(`Error al liberar el asiento: ${error.message}`);
    }
  }

  private readonly FILAS_VIP = new Set(['R', 'S', 'T']);

  esFilaVip(fila: string): boolean {
    return this.FILAS_VIP.has((fila || '').trim().toUpperCase());
  }

  calcularPrecioGeneralPesos(funcion: any): number {
    return Number(funcion?.precio_pesos) || 0;
  }

  calcularPrecioVipPesos(funcion: any): number {
    return this.calcularPrecioGeneralPesos(funcion) * 2;
  }

  calcularPrecioGeneralPuntos(funcion: any): number {
    return Number(funcion?.precio_puntos) || 0;
  }

  calcularPrecioVipPuntos(funcion: any): number {
    return this.calcularPrecioGeneralPuntos(funcion) * 2;
  }

  obtenerPrecioAsiento(funcion: any, fila: string, metodoPago: string = 'efectivo'): number {
    const esVip = this.esFilaVip(fila);
    if (metodoPago === 'puntos') {
      return esVip
        ? this.calcularPrecioVipPuntos(funcion)
        : this.calcularPrecioGeneralPuntos(funcion);
    }
    return esVip ? this.calcularPrecioVipPesos(funcion) : this.calcularPrecioGeneralPesos(funcion);
  }

  /**
   * Confirma la compra: Calcula el total y genera la orden unificada.
   */
  async confirmarCompra(
    usuarioId: string | null,
    asientosSeleccionados: any[],
    metodoPago: string = 'efectivo',
  ): Promise<string> {
    if (asientosSeleccionados.length === 0) {
      throw new Error('No hay asientos seleccionados para comprar.');
    }

    const funcionId = asientosSeleccionados[0].funcion_id;

    const { data: funcionData, error: errorFuncion } = await supabase
      .from('funciones')
      .select('precio_pesos, precio_puntos')
      .eq('id', funcionId)
      .single();

    if (errorFuncion || !funcionData) {
      throw new Error('No se pudo obtener la información de precios de la función.');
    }

    let totalCalculado = 0;

    for (const asiento of asientosSeleccionados) {
      totalCalculado += this.obtenerPrecioAsiento(funcionData, asiento.fila, metodoPago);
    }

    const codigoUnico = this.generarCodigoRetiro();
    const idsAsientos = asientosSeleccionados.map((a) => a.id);

    const { data: orden, error: errorOrden } = await supabase
      .from('ordenes')
      .insert([
        {
          usuario_id: usuarioId,
          codigo_retiro: codigoUnico,
          estado: 'pagado',
          total: totalCalculado,
          metodo_pago: metodoPago,
        },
      ])
      .select()
      .single();

    if (errorOrden) throw new Error(`Error al generar la orden: ${errorOrden.message}`);

    const { error: errorEntradas } = await supabase
      .from('entradas')
      .update({
        estado: 'comprado',
        orden_id: orden.id,
      })
      .in('id', idsAsientos);

    if (errorEntradas) throw new Error(`Error al actualizar entradas: ${errorEntradas.message}`);

    return codigoUnico;
  }

  async confirmarCompraConCandy(
    usuarioId: string | null,
    asientos: any[] = [],
    metodoPago: string,
    itemsCandyJson: any[] = [],
    itemsConIdsFisicos: any[] = [],
    totalGeneral: number = 0,
  ): Promise<string> {
    const codigoRetiro = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: ordenCreada, error: errorOrden } = await supabase
      .from('ordenes')
      .insert([
        {
          usuario_id: usuarioId,
          codigo_retiro: codigoRetiro,
          metodo_pago: metodoPago,
          estado: 'pagado',
          total: totalGeneral,
          items_candy: itemsCandyJson.length > 0 ? itemsCandyJson : null,
        },
      ])
      .select()
      .single();

    if (errorOrden) throw errorOrden;

    if (asientos && asientos.length > 0) {
      const idsAsientos = asientos.map((a) => a.id);
      const { error: errorAsientos } = await supabase
        .from('entradas')
        .update({ estado: 'comprado', orden_id: ordenCreada.id })
        .in('id', idsAsientos);

      if (errorAsientos) throw errorAsientos;
    }

    const idsFisicosAreservar: string[] = [];
    itemsConIdsFisicos.forEach((item) => {
      if (item.idsFisicos) {
        idsFisicosAreservar.push(...item.idsFisicos);
      }
    });

    if (idsFisicosAreservar.length > 0) {
      const { error: errorReserva } = await supabase
        .from('productos')
        .update({
          estado: 'reservado',
          orden_id: ordenCreada.id,
        })
        .in('id', idsFisicosAreservar);

      if (errorReserva) throw errorReserva;
    }

    return codigoRetiro;
  }

  async verificarYAprobarOrden(
    codigoRetiro: string,
    usuarioActual?: { id?: string | null; email?: string | null },
  ): Promise<any> {
    const codigoNormalizado = codigoRetiro.trim().toUpperCase();

    // 1. Buscar la orden por su código de retiro
    const { data: orden, error: errorBusqueda } = await supabase
      .from('ordenes')
      .select('id, codigo_retiro, estado, total, metodo_pago, items_candy')
      .eq('codigo_retiro', codigoNormalizado)
      .single();

    if (errorBusqueda || !orden) {
      throw new Error('No se encontró ninguna orden con el código ingresado.');
    }

    if (orden.estado === 'aprobado') {
      throw new Error('Esta orden ya fue verificada y aprobada anteriormente.');
    }

    const fechaRetiro = new Date().toISOString();

    // 2. Actualizar el estado de la orden principal a 'aprobado'
    const { data: ordenActualizada, error: errorUpdateOrden } = await supabase
      .from('ordenes')
      .update({ estado: 'aprobado' })
      .eq('id', orden.id)
      .select()
      .single();

    if (errorUpdateOrden) {
      throw new Error(`Error al aprobar la orden: ${errorUpdateOrden.message}`);
    }

    // 3. Marcar entradas como 'retirado', aprobadas y con fecha exacta de retiro
    // Solo las entradas con estado 'retirado' cuentan como película vista
    const { data: entradasActualizadas, error: errorEntradas } = await supabase
      .from('entradas')
      .update({
        estado: 'retirado',
        aprobada: true,
        retirado_en: fechaRetiro,
      })
      .eq('orden_id', orden.id)
      .select(`
        id,
        funcion_id,
        funciones (
          pelicula_id
        )
      `);

    if (errorEntradas) {
      console.error('Nota: La orden puede no contener entradas de cine.', errorEntradas.message);
    } else if (entradasActualizadas && entradasActualizadas.length > 0) {
      // Contamos cuántos asientos (entradas) corresponden a cada película en esta orden aprobada
      const conteoPorPelicula = new Map<string, number>();

      for (const entrada of entradasActualizadas as any[]) {
        const funcionRel = Array.isArray(entrada.funciones)
          ? entrada.funciones[0]
          : entrada.funciones;
        const peliculaId = funcionRel?.pelicula_id;

        if (peliculaId) {
          conteoPorPelicula.set(peliculaId, (conteoPorPelicula.get(peliculaId) || 0) + 1);
        }
      }

      for (const [peliculaId, cantidadAsientos] of conteoPorPelicula.entries()) {
        await this.peliculasService.incrementarCantidadVendida(peliculaId, cantidadAsientos);
      }
    }

    // 4. Actualizar productos físicos vinculados a 'vendido' (si estaban 'reservado' o 'comprado')
    const { error: errorProdOrden } = await supabase
      .from('productos')
      .update({ estado: 'vendido' })
      .eq('orden_id', orden.id)
      .in('estado', ['reservado', 'comprado']);

    if (errorProdOrden) {
      console.error('Error al actualizar los productos de la orden:', errorProdOrden.message);
    }

    // Respaldo por IDs en items_candy si existieran
    if (orden.items_candy && Array.isArray(orden.items_candy) && orden.items_candy.length > 0) {
      for (const item of orden.items_candy) {
        const productoId = item.id || item.producto_id;
        if (productoId) {
          await supabase
            .from('productos')
            .update({ estado: 'vendido' })
            .eq('id', productoId)
            .in('estado', ['reservado', 'comprado']);
        }
      }
    }

    // 5. Registrar en el log de actividad quién validó el QR
    await this.logsService.registrarLog({
      accion: 'VALIDAR_QR',
      entidad: 'orden',
      entidadId: orden.id,
      detalle: `Validó orden con código ${orden.codigo_retiro} (Total: $${orden.total}, Método: ${orden.metodo_pago || 'N/A'})`,
      usuarioId: usuarioActual?.id,
      usuarioEmail: usuarioActual?.email,
    });

    return ordenActualizada;
  }

  // 1. Función para extraer la edad mínima numérica del texto del límite
  async obtenerEdadMinima(limiteTexto: string): Promise<number> {
    if (!limiteTexto || limiteTexto.toUpperCase() === 'ATP') {
      return 0;
    }
    const matches = limiteTexto.match(/\d+/);
    return matches ? parseInt(matches[0], 10) : 0;
  }

  // 2. Función para calcular la edad del usuario según su fecha de nacimiento
  async calcularEdadUsuario(fechaNacimiento: string): Promise<number> {
    if (!fechaNacimiento) return 0;

    const partes = fechaNacimiento.split('T')[0].split('-');
    if (partes.length === 3) {
      const anioNac = parseInt(partes[0], 10);
      const mesNac = parseInt(partes[1], 10) - 1;
      const diaNac = parseInt(partes[2], 10);

      const hoy = new Date();
      let edad = hoy.getFullYear() - anioNac;
      const m = hoy.getMonth() - mesNac;

      if (m < 0 || (m === 0 && hoy.getDate() < diaNac)) {
        edad--;
      }
      return edad;
    }

    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }
}